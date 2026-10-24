import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { parseBody, requireEditor } from "@/lib/auth/require-editor";
import { parsePrice } from "@/lib/payments/price";
import { withOrgScope } from "@/lib/tenant-db";

const PatchSchema = z.object({
  promise: z.string().trim().min(1).max(1000),
  mechanism: z.string().trim().min(1).max(2000),
  bonuses: z.array(z.string().trim().min(1).max(300)).max(20),
  guaranteeText: z.string().trim().min(1).max(1000),
  priceTiers: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        price: z.string().trim().min(1).max(40),
        description: z.string().trim().max(300),
      })
    )
    .min(1)
    .max(6),
});

/**
 * Replaces the offer's editable fields. Price changes only affect FUTURE
 * orders (an order stores the amount it was charged). A published product
 * must keep at least one price the checkout can actually charge.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await params;

  const body = await parseBody(request, PatchSchema);
  if ("response" in body) return body.response;
  const { promise, mechanism, bonuses, guaranteeText, priceTiers } = body.data;

  const result = await withOrgScope(user.organizationId, async (tx) => {
    const offer = await tx.offer.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { product: { select: { publishedAt: true } } },
    });
    if (!offer) return "not_found" as const;
    if (offer.product.publishedAt && !priceTiers.some((t) => parsePrice(t.price))) return "unpriceable" as const;

    await tx.offer.update({
      where: { id },
      data: {
        promise,
        mechanism,
        guaranteeText,
        bonusesJson: bonuses as unknown as Prisma.InputJsonValue,
        priceTiersJson: priceTiers as unknown as Prisma.InputJsonValue,
      },
    });
    return "ok" as const;
  });

  if (result === "not_found") return NextResponse.json({ error: "Offer not found." }, { status: 404 });
  if (result === "unpriceable") {
    return NextResponse.json(
      { error: "This product is live, so at least one price must be an amount like \"$97\" or \"₦15,000\"." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
