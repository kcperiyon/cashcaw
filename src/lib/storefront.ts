import type { PriceTier, SalesPageCopy } from "@/lib/ai/provider";
import { parsePrice, type ParsedPrice } from "@/lib/payments/price";
import { withOrgScope, withPublicSlugScope } from "@/lib/tenant-db";

export interface StorefrontTier extends PriceTier {
  /** null when the AI-written price string can't be turned into an exact amount — such a tier can't be bought. */
  parsed: ParsedPrice | null;
}

export interface Storefront {
  productId: string;
  organizationId: string;
  title: string;
  format: "course" | "ebook" | "template";
  audience: string;
  transformation: string;
  promise: string;
  mechanism: string;
  bonuses: string[];
  guaranteeText: string;
  tiers: StorefrontTier[];
  page: {
    positioning: "outcome" | "pain" | "identity";
    headline: string;
    subheadline: string;
    copy: SalesPageCopy;
  };
}

/**
 * Everything the public sales page and checkout need, for one published slug.
 * Resolves slug -> org through the narrow public RLS policy, then reads the
 * rest org-scoped. Returns null unless the product is published AND has an
 * offer with a selected sales-page variant — a half-built product is never
 * served. Prices come from the stored offer, never from the client.
 */
export async function getPublishedStorefront(slug: string): Promise<Storefront | null> {
  const ref = await withPublicSlugScope(slug, (tx) =>
    tx.product.findFirst({
      where: { publicSlug: slug, publishedAt: { not: null } },
      select: { id: true, organizationId: true },
    })
  );
  if (!ref) return null;

  const product = await withOrgScope(ref.organizationId, (tx) =>
    tx.product.findFirst({
      where: { id: ref.id, organizationId: ref.organizationId },
      include: { offer: { include: { salesPages: { where: { selected: true }, take: 1 } } } },
    })
  );
  const offer = product?.offer;
  const page = offer?.salesPages[0];
  if (!product || !offer || !page) return null;

  const tiers = (offer.priceTiersJson as unknown as PriceTier[]).map((t) => ({ ...t, parsed: parsePrice(t.price) }));

  return {
    productId: product.id,
    organizationId: product.organizationId,
    title: product.title,
    format: product.format,
    audience: product.audience,
    transformation: product.transformation,
    promise: offer.promise,
    mechanism: offer.mechanism,
    bonuses: offer.bonusesJson as unknown as string[],
    guaranteeText: offer.guaranteeText,
    tiers,
    page: {
      positioning: page.positioning,
      headline: page.headline,
      subheadline: page.subheadline,
      copy: page.copyJson as unknown as SalesPageCopy,
    },
  };
}
