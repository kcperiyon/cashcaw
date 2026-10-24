import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, requireEditor } from "@/lib/auth/require-editor";
import { withOrgScope } from "@/lib/tenant-db";

const PatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(30000),
    exercise: z.string().trim().min(1).max(5000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.");

/** Edits a lesson's title, body or exercise. Buyers see the change immediately. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await params;

  const body = await parseBody(request, PatchSchema);
  if ("response" in body) return body.response;

  const found = await withOrgScope(user.organizationId, async (tx) => {
    const lesson = await tx.lesson.findFirst({
      where: { id, module: { product: { organizationId: user.organizationId } } },
    });
    if (!lesson) return false;
    await tx.lesson.update({ where: { id }, data: body.data });
    return true;
  });
  if (!found) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await params;

  const found = await withOrgScope(user.organizationId, async (tx) => {
    const lesson = await tx.lesson.findFirst({
      where: { id, module: { product: { organizationId: user.organizationId } } },
    });
    if (!lesson) return false;
    await tx.lesson.delete({ where: { id } });
    return true;
  });
  if (!found) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
