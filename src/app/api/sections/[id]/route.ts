import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, requireEditor } from "@/lib/auth/require-editor";
import { withOrgScope } from "@/lib/tenant-db";

const PatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(60000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.");

/** Edits an ebook chapter or template item. Buyers see the change immediately. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await params;

  const body = await parseBody(request, PatchSchema);
  if ("response" in body) return body.response;

  const found = await withOrgScope(user.organizationId, async (tx) => {
    const section = await tx.contentSection.findFirst({ where: { id, product: { organizationId: user.organizationId } } });
    if (!section) return false;
    await tx.contentSection.update({ where: { id }, data: body.data });
    return true;
  });
  if (!found) return NextResponse.json({ error: "Section not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** Deletes a chapter/item. An ebook or template pack must keep at least one — delete the product instead. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await params;

  const result = await withOrgScope(user.organizationId, async (tx) => {
    const section = await tx.contentSection.findFirst({ where: { id, product: { organizationId: user.organizationId } } });
    if (!section) return "not_found" as const;
    const siblings = await tx.contentSection.count({ where: { productId: section.productId } });
    if (siblings <= 1) return "last" as const;
    await tx.contentSection.delete({ where: { id } });
    return "deleted" as const;
  });

  if (result === "not_found") return NextResponse.json({ error: "Section not found." }, { status: 404 });
  if (result === "last") {
    return NextResponse.json({ error: "This product needs at least one section. Delete the product instead." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
