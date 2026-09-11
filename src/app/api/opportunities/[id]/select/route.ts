import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { withOrgScope } from "@/lib/tenant-db";

/**
 * Marks one opportunity as selected — the founder's actual choice of what
 * to build next (Phase 1's Product Factory reads this). Deliberately does
 * NOT archive the others: a founder can select one to build now while
 * still keeping the rest visible for later.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;

  const updated = await withOrgScope(user.organizationId, (tx) =>
    tx.opportunity.updateMany({
      where: { id, organizationId: user.organizationId },
      data: { status: "selected" },
    })
  );

  if (updated.count === 0) {
    return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
