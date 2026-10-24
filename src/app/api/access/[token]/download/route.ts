import { NextResponse } from "next/server";
import { downloadFilename, loadDeliverable, toMarkdown } from "@/lib/delivery";
import { withOrderScope, withOrgScope } from "@/lib/tenant-db";

/**
 * Buyer download of what they paid for, as one Markdown file. The unguessable
 * order token is the credential; only a PAID order's enrolled products are
 * ever returned.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const order = await withOrderScope({ token }, (tx) =>
    tx.order.findUnique({ where: { accessToken: token }, include: { enrollments: true } })
  );
  if (!order || order.status !== "paid" || order.enrollments.length === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const deliverables = await withOrgScope(order.organizationId, async (tx) => {
    const found = [];
    for (const enrollment of order.enrollments) {
      const d = await loadDeliverable(tx, order.organizationId, enrollment.productId);
      if (d) found.push(d);
    }
    return found;
  });
  if (deliverables.length === 0) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = deliverables.map(toMarkdown).join("\n\n---\n\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${downloadFilename(deliverables[0].title)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
