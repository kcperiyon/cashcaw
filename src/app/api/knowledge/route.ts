import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { withOrgScope } from "@/lib/tenant-db";
import { ingestText } from "@/lib/knowledge/client";

const IngestSchema = z.object({
  name: z.string().min(1).max(200),
  text: z.string().min(1).max(20000),
});

/** Lists this org's ingested knowledge sources — proof that "My Expertise" has anything in it. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const sources = await withOrgScope(user.organizationId, (tx) =>
    tx.knowledgeSource.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
    })
  );
  return NextResponse.json({ sources });
}

/**
 * Drops a text note into "My Expertise": ingests it into platform-services'
 * knowledge/RAG service (real, shared infrastructure — see
 * src/lib/knowledge/client.ts) and records the source locally so the org can
 * see and later delete what it fed in.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = IngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { name, text } = parsed.data;

  const source = await withOrgScope(user.organizationId, (tx) =>
    tx.knowledgeSource.create({
      data: { organizationId: user.organizationId, name, kind: "text" },
    })
  );

  try {
    await ingestText({ sourceId: source.id, sourceName: name, text, organizationId: user.organizationId });
  } catch (err) {
    // Roll back the local record — a source that failed to actually ingest
    // shouldn't appear as if it's queryable.
    await withOrgScope(user.organizationId, (tx) => tx.knowledgeSource.delete({ where: { id: source.id } }));
    const message = err instanceof Error ? err.message : "Failed to ingest into the knowledge service.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ source });
}
