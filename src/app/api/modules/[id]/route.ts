import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, requireEditor } from "@/lib/auth/require-editor";
import { withOrgScope } from "@/lib/tenant-db";

const PatchSchema = z.object({ title: z.string().trim().min(1).max(200) });

/** Renames a course module. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await params;

  const body = await parseBody(request, PatchSchema);
  if ("response" in body) return body.response;

  const found = await withOrgScope(user.organizationId, async (tx) => {
    const mod = await tx.module.findFirst({ where: { id, product: { organizationId: user.organizationId } } });
    if (!mod) return false;
    await tx.module.update({ where: { id }, data: { title: body.data.title } });
    return true;
  });
  if (!found) return NextResponse.json({ error: "Module not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** Deletes a module and its lessons. A course must keep at least one module — delete the product instead. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await params;

  const result = await withOrgScope(user.organizationId, async (tx) => {
    const mod = await tx.module.findFirst({ where: { id, product: { organizationId: user.organizationId } } });
    if (!mod) return "not_found" as const;
    const siblings = await tx.module.count({ where: { productId: mod.productId } });
    if (siblings <= 1) return "last" as const;
    await tx.lesson.deleteMany({ where: { moduleId: id } });
    await tx.module.delete({ where: { id } });
    return "deleted" as const;
  });

  if (result === "not_found") return NextResponse.json({ error: "Module not found." }, { status: 404 });
  if (result === "last") {
    return NextResponse.json({ error: "A course needs at least one module. Delete the product instead." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
