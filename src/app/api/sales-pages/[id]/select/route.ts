import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { withOrgScope } from "@/lib/tenant-db";

/** Marks one sales-page variant selected, and unselects its siblings — only one variant is "the" page for an offer at a time. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;

  const result = await withOrgScope(user.organizationId, async (tx) => {
    const page = await tx.salesPage.findFirst({
      where: { id, offer: { organizationId: user.organizationId } },
    });
    if (!page) return null;

    await tx.salesPage.updateMany({ where: { offerId: page.offerId }, data: { selected: false } });
    await tx.salesPage.update({ where: { id }, data: { selected: true } });
    return true;
  });

  if (!result) return NextResponse.json({ error: "Sales page not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
