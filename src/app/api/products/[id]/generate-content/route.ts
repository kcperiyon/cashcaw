import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { withOrgScope } from "@/lib/tenant-db";
import { getBusinessAIProvider } from "@/lib/ai";

/**
 * The actual content-generation step. Idempotent-ish on purpose: re-running
 * this on an already-generated product wipes and regenerates its content
 * rather than appending duplicates, since a founder re-running it almost
 * always means "I want a fresh pass," not "add more."
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;

  const product = await withOrgScope(user.organizationId, (tx) =>
    tx.product.findFirst({ where: { id, organizationId: user.organizationId } })
  );
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  let content;
  try {
    content = await getBusinessAIProvider().generateProductContent({
      format: product.format,
      title: product.title,
      audience: product.audience,
      transformation: product.transformation,
      outline: product.outlineJson as string[],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate content right now.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await withOrgScope(user.organizationId, async (tx) => {
    // Clear any prior generation before writing the fresh one.
    const existingModules = await tx.module.findMany({ where: { productId: id }, select: { id: true } });
    if (existingModules.length > 0) {
      await tx.lesson.deleteMany({ where: { moduleId: { in: existingModules.map((m) => m.id) } } });
      await tx.module.deleteMany({ where: { productId: id } });
    }
    await tx.contentSection.deleteMany({ where: { productId: id } });

    if (content.format === "course") {
      for (let i = 0; i < content.modules.length; i++) {
        const mod = content.modules[i];
        const createdModule = await tx.module.create({ data: { productId: id, order: i, title: mod.title } });
        for (let j = 0; j < mod.lessons.length; j++) {
          const lesson = mod.lessons[j];
          await tx.lesson.create({
            data: { moduleId: createdModule.id, order: j, title: lesson.title, content: lesson.content, exercise: lesson.exercise },
          });
        }
      }
    } else {
      const kind = content.format === "ebook" ? "chapter" : "template_item";
      for (let i = 0; i < content.sections.length; i++) {
        const section = content.sections[i];
        await tx.contentSection.create({
          data: { productId: id, order: i, kind, title: section.title, content: section.content },
        });
      }
    }

    await tx.product.update({ where: { id }, data: { status: "generated" } });
  });

  return NextResponse.json({ ok: true });
}
