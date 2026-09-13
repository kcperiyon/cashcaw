import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/current-user";
import { withOrgScope } from "@/lib/tenant-db";
import { getBusinessAIProvider } from "@/lib/ai";

/**
 * Generates the 3 sales-page variants for an offer. Re-posting wipes and
 * regenerates — same "a fresh pass, not an addition" rule as product
 * content generation.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;

  const offer = await withOrgScope(user.organizationId, (tx) =>
    tx.offer.findFirst({ where: { id, organizationId: user.organizationId }, include: { product: true } })
  );
  if (!offer) return NextResponse.json({ error: "Offer not found." }, { status: 404 });

  let output;
  try {
    output = await getBusinessAIProvider().generateSalesPages({
      title: offer.product.title,
      audience: offer.product.audience,
      transformation: offer.product.transformation,
      offer: {
        promise: offer.promise,
        mechanism: offer.mechanism,
        bonuses: offer.bonusesJson as string[],
        guaranteeText: offer.guaranteeText,
        priceTiers: offer.priceTiersJson as { name: string; price: string; description: string }[],
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate sales pages right now.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const salesPages = await withOrgScope(user.organizationId, async (tx) => {
    await tx.salesPage.deleteMany({ where: { offerId: id } });
    return Promise.all(
      output.variants.map((v) =>
        tx.salesPage.create({
          data: {
            offerId: id,
            positioning: v.positioning,
            headline: v.headline,
            subheadline: v.subheadline,
            copyJson: v.copy as unknown as Prisma.InputJsonValue,
            clarityScore: v.clarityScore,
            rationale: v.rationale,
          },
        })
      )
    );
  });

  return NextResponse.json({ salesPages });
}
