import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { retrieve } from "@/lib/knowledge/client";

const QuerySchema = z.object({ query: z.string().min(1).max(500) });

/**
 * The other half of Phase 0's exit criteria: a real query against
 * platform-services' knowledge service, scoped to this org, proving the
 * round trip actually works — not just that ingest returned 200.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = QuerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid query." }, { status: 400 });
  }

  try {
    const results = await retrieve({ query: parsed.data.query, organizationId: user.organizationId });
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to query the knowledge service.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
