import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPaymentProvider } from "@/lib/payments";
import { appOrigin } from "@/lib/origin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getPublishedStorefront } from "@/lib/storefront";
import { withOrderScope, withOrgScope } from "@/lib/tenant-db";

const bodySchema = z.object({
  tierIndex: z.number().int().min(0).max(20),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
});

/**
 * Public, unauthenticated. Starts a purchase: records a pending order for the
 * chosen tier, then asks the payment provider where to send the buyer. The
 * price always comes from the stored offer — the client only says WHICH tier.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!rateLimit(`checkout:${clientIp(request)}:${slug}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your name and a valid email address." }, { status: 400 });
  }
  const { tierIndex, name, email } = parsed.data;

  const storefront = await getPublishedStorefront(slug);
  if (!storefront) return NextResponse.json({ error: "This page is not available." }, { status: 404 });

  const tier = storefront.tiers[tierIndex];
  if (!tier) return NextResponse.json({ error: "That option doesn't exist." }, { status: 400 });
  if (!tier.parsed) return NextResponse.json({ error: "That option can't be purchased online." }, { status: 400 });

  const accessToken = randomBytes(24).toString("base64url");
  const order = await withOrgScope(storefront.organizationId, async (tx) => {
    const created = await tx.order.create({
      data: {
        organizationId: storefront.organizationId,
        productId: storefront.productId,
        buyerEmail: email,
        buyerName: name,
        tierName: tier.name,
        currency: tier.parsed!.currency,
        totalMinor: tier.parsed!.amountMinor,
        accessToken,
        lines: {
          create: {
            productId: storefront.productId,
            kind: "primary",
            name: `${storefront.title} — ${tier.name}`,
            amountMinor: tier.parsed!.amountMinor,
          },
        },
      },
    });
    await tx.paymentTransaction.create({
      data: {
        orderId: created.id,
        provider: getPaymentProvider().id,
        providerRef: `cc_${created.id}`,
        amountMinor: created.totalMinor,
        currency: created.currency,
      },
    });
    return created;
  });

  try {
    const provider = getPaymentProvider();
    const charge = await provider.charge({
      reference: `cc_${order.id}`,
      amountMinor: order.totalMinor,
      currency: order.currency,
      buyerEmail: email,
      buyerName: name,
      description: storefront.title,
      orderToken: accessToken,
      origin: appOrigin(request),
    });
    return NextResponse.json({ redirectUrl: charge.redirectUrl });
  } catch (err) {
    console.error("checkout: provider charge failed", err);
    await withOrderScope({ token: accessToken }, async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: "failed" } });
      await tx.paymentTransaction.updateMany({ where: { orderId: order.id }, data: { status: "failed" } });
    });
    return NextResponse.json({ error: "We couldn't start the payment. Please try again." }, { status: 502 });
  }
}
