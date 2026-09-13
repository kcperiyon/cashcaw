import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/current-user";
import { withOrgScope } from "@/lib/tenant-db";
import { getBusinessAIProvider } from "@/lib/ai";

/** Fetches the product's offer, with its sales-page variants if any exist. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;

  const offer = await withOrgScope(user.organizationId, (tx) =>
    tx.offer.findFirst({
      where: { productId: id, organizationId: user.organizationId },
      include: { salesPages: { orderBy: { createdAt: "asc" } } },
    })
  );
  return NextResponse.json({ offer });
}

/**
 * Builds the Offer for a product — promise, mechanism, bonuses, guarantee,
 * price tiers. One per product; re-posting replaces the prior offer (and
 * its sales pages, since they're written for the offer that's being
 * replaced) rather than accumulating duplicates.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;

  const product = await withOrgScope(user.organizationId, (tx) =>
    tx.product.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { modules: { include: { lessons: true } }, sections: true },
    })
  );
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  if (product.status !== "generated") {
    return NextResponse.json({ error: "Generate the product's content before building an offer." }, { status: 400 });
  }

  let offerOutput;
  try {
    offerOutput = await getBusinessAIProvider().generateOffer({
      title: product.title,
      audience: product.audience,
      transformation: product.transformation,
      outline: product.outlineJson as string[],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not build the offer right now.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const offer = await withOrgScope(user.organizationId, async (tx) => {
    const existing = await tx.offer.findUnique({ where: { productId: id } });
    if (existing) {
      await tx.salesPage.deleteMany({ where: { offerId: existing.id } });
      await tx.offer.delete({ where: { id: existing.id } });
    }
    return tx.offer.create({
      data: {
        organizationId: user.organizationId,
        productId: id,
        promise: offerOutput.promise,
        mechanism: offerOutput.mechanism,
        bonusesJson: offerOutput.bonuses,
        guaranteeText: offerOutput.guaranteeText,
        priceTiersJson: offerOutput.priceTiers as unknown as Prisma.InputJsonValue,
      },
    });
  });

  return NextResponse.json({ offer });
}
