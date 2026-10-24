import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, requireEditor } from "@/lib/auth/require-editor";
import { withOrgScope } from "@/lib/tenant-db";

const PatchSchema = z.object({ title: z.string().trim().min(1).max(200) });

/** Renames a repurposed asset. (Its generated content is replaced by regenerating, not edited in place.) */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await params;

  const body = await parseBody(request, PatchSchema);
  if ("response" in body) return body.response;

  const found = await withOrgScope(user.organizationId, async (tx) => {
    const asset = await tx.repurposedAsset.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!asset) return false;
    await tx.repurposedAsset.update({ where: { id }, data: { title: body.data.title } });
    return true;
  });
  if (!found) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await params;

  const found = await withOrgScope(user.organizationId, async (tx) => {
    const asset = await tx.repurposedAsset.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!asset) return false;
    await tx.repurposedAsset.delete({ where: { id } });
    return true;
  });
  if (!found) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
