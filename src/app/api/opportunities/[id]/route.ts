import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth/require-editor";
import { withOrgScope } from "@/lib/tenant-db";

/** Deletes an opportunity. Refused once a product has been built from it — delete that product first. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await params;

  const result = await withOrgScope(user.organizationId, async (tx) => {
    const opportunity = await tx.opportunity.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!opportunity) return "not_found" as const;
    const products = await tx.product.count({ where: { opportunityId: id } });
    if (products > 0) return "has_products" as const;
    await tx.opportunity.delete({ where: { id } });
    return "deleted" as const;
  });

  if (result === "not_found") return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
  if (result === "has_products") {
    return NextResponse.json({ error: "A product was built from this. Delete the product first." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
