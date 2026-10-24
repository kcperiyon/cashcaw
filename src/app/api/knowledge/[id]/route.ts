import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth/require-editor";
import { deleteSource } from "@/lib/knowledge/client";
import { withOrgScope } from "@/lib/tenant-db";

/**
 * Removes a "My Expertise" note: its chunks come out of the shared knowledge
 * service first, then the local record. If the service call fails the local
 * record is kept, so nothing is left queryable-but-invisible.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await params;

  const source = await withOrgScope(user.organizationId, (tx) =>
    tx.knowledgeSource.findFirst({ where: { id, organizationId: user.organizationId } })
  );
  if (!source) return NextResponse.json({ error: "Source not found." }, { status: 404 });

  try {
    await deleteSource(id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't remove it from the knowledge service.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await withOrgScope(user.organizationId, (tx) => tx.knowledgeSource.delete({ where: { id } }));
  return NextResponse.json({ ok: true });
}
