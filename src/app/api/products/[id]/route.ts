import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { parseBody, requireEditor } from "@/lib/auth/require-editor";
import { withOrgScope } from "@/lib/tenant-db";

/** Full product detail — modules/lessons for a course, sections for ebook/template. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;

  const product = await withOrgScope(user.organizationId, (tx) =>
    tx.product.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } },
        sections: { orderBy: { order: "asc" } },
      },
    })
  );

  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  return NextResponse.json({ product });
}

const PatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    audience: z.string().trim().min(1).max(500),
    transformation: z.string().trim().min(1).max(1000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.");

/** Edits the product's headline fields. The public link (slug) never changes. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await params;

  const body = await parseBody(request, PatchSchema);
  if ("response" in body) return body.response;

  const updated = await withOrgScope(user.organizationId, async (tx) => {
    const existing = await tx.product.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!existing) return null;
    return tx.product.update({ where: { id }, data: body.data });
  });
  if (!updated) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/**
 * Deletes a product and everything under it (content, offer, sales pages,
 * repurposed assets, abandoned checkouts). Refused once anyone has PAID for
 * it — those buyers hold a delivery link, so the product must stay; the
 * creator unpublishes it instead.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await params;

  const result = await withOrgScope(user.organizationId, async (tx) => {
    const product = await tx.product.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!product) return "not_found" as const;

    const sold = await tx.order.count({ where: { productId: id, status: { in: ["paid", "refunded"] } } });
    if (sold > 0) return "has_sales" as const;

    const orderIds = (await tx.order.findMany({ where: { productId: id }, select: { id: true } })).map((o) => o.id);
    await tx.orderLine.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.paymentTransaction.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.order.deleteMany({ where: { id: { in: orderIds } } });

    const offer = await tx.offer.findUnique({ where: { productId: id } });
    if (offer) {
      await tx.salesPage.deleteMany({ where: { offerId: offer.id } });
      await tx.offer.delete({ where: { id: offer.id } });
    }
    await tx.repurposedAsset.deleteMany({ where: { productId: id } });
    const moduleIds = (await tx.module.findMany({ where: { productId: id }, select: { id: true } })).map((m) => m.id);
    await tx.lesson.deleteMany({ where: { moduleId: { in: moduleIds } } });
    await tx.module.deleteMany({ where: { productId: id } });
    await tx.contentSection.deleteMany({ where: { productId: id } });
    await tx.product.delete({ where: { id } });
    return "deleted" as const;
  });

  if (result === "not_found") return NextResponse.json({ error: "Product not found." }, { status: 404 });
  if (result === "has_sales") {
    return NextResponse.json(
      { error: "This product has paying customers, so it can't be deleted. Unpublish it instead." },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
