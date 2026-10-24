import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { withOrgScope } from "@/lib/tenant-db";

/** The creator's view of a product's orders — buyer, tier, amount, status, newest first. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;

  const orders = await withOrgScope(user.organizationId, (tx) =>
    tx.order.findMany({
      where: { productId: id, organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        buyerName: true,
        buyerEmail: true,
        tierName: true,
        currency: true,
        totalMinor: true,
        status: true,
        createdAt: true,
        paidAt: true,
      },
    })
  );
  return NextResponse.json({ orders });
}
