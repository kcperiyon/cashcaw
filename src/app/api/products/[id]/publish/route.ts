import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { withOrgScope } from "@/lib/tenant-db";
import { parsePrice } from "@/lib/payments/price";
import { slugify } from "@/lib/slug";
import type { PriceTier } from "@/lib/ai/provider";

const bodySchema = z.object({ published: z.boolean() });

/**
 * Publishes or unpublishes the product's public sales page (/p/<slug>).
 * Publishing needs a finished product, an offer, a SELECTED sales-page
 * variant, and at least one price tier that can actually be charged.
 * Unpublishing keeps the slug so re-publishing restores the same link.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (user.role === "viewer") return NextResponse.json({ error: "Viewers can't publish." }, { status: 403 });
  const { id } = await params;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Expected { published: boolean }." }, { status: 400 });

  const product = await withOrgScope(user.organizationId, (tx) =>
    tx.product.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { offer: { include: { salesPages: { where: { selected: true }, take: 1 } } } },
    })
  );
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  if (!parsed.data.published) {
    await withOrgScope(user.organizationId, (tx) =>
      tx.product.update({ where: { id }, data: { publishedAt: null } })
    );
    return NextResponse.json({ ok: true, published: false, publicSlug: product.publicSlug });
  }

  if (product.status !== "generated") {
    return NextResponse.json({ error: "Generate the product's content before publishing." }, { status: 400 });
  }
  if (!product.offer) return NextResponse.json({ error: "Build an offer before publishing." }, { status: 400 });
  if (product.offer.salesPages.length === 0) {
    return NextResponse.json({ error: "Generate sales pages and choose one before publishing." }, { status: 400 });
  }
  const tiers = product.offer.priceTiersJson as unknown as PriceTier[];
  if (!tiers.some((t) => parsePrice(t.price))) {
    return NextResponse.json(
      { error: "None of the offer's prices could be read as an amount (e.g. \"$97\"). Rebuild the offer." },
      { status: 400 }
    );
  }

  // The slug column is globally unique but RLS hides other orgs' rows, so a
  // collision can only be detected by the unique constraint — retry on it.
  for (let attempt = 0; attempt < 5; attempt++) {
    const publicSlug = product.publicSlug ?? `${slugify(product.title) || "product"}-${randomBytes(3).toString("hex")}`;
    try {
      await withOrgScope(user.organizationId, (tx) =>
        tx.product.update({ where: { id }, data: { publicSlug, publishedAt: new Date() } })
      );
      return NextResponse.json({ ok: true, published: true, publicSlug });
    } catch (err) {
      if ((err as { code?: string }).code !== "P2002" || product.publicSlug) throw err;
    }
  }
  return NextResponse.json({ error: "Could not allocate a public link. Try again." }, { status: 500 });
}
