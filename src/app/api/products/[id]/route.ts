import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
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
