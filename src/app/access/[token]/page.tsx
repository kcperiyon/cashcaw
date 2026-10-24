import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadDeliverable } from "@/lib/delivery";
import { formatMoney } from "@/lib/payments/price";
import { settleOrder } from "@/lib/payments/settle";
import { withOrderScope, withOrgScope } from "@/lib/tenant-db";

// A buyer's private page: never indexed, never cached.
export const metadata: Metadata = { title: "Your purchase", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccessPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const load = () =>
    withOrderScope({ token }, (tx) =>
      tx.order.findUnique({ where: { accessToken: token }, include: { enrollments: true } })
    );
  let order = await load();
  if (!order) notFound();

  // A buyer returning to a still-pending order (closed the tab mid-payment,
  // slow callback) gets it re-checked with the provider; settleOrder is idempotent.
  if (order.status === "pending") {
    try {
      await settleOrder(token);
      order = (await load()) ?? order;
    } catch (err) {
      console.error("access: settle failed", err);
    }
  }

  if (order.status !== "paid") {
    const slug = await withOrgScope(order.organizationId, async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: order.productId, organizationId: order.organizationId },
        select: { publicSlug: true },
      });
      return product?.publicSlug ?? null;
    });
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="mb-3 text-2xl font-semibold text-neutral-900">
          {order.status === "pending" ? "Payment not confirmed yet" : "Payment didn't go through"}
        </h1>
        <p className="mb-6 text-neutral-600">
          {order.status === "pending"
            ? "We haven't received confirmation of your payment. If you've just paid, refresh this page in a moment."
            : "We couldn't confirm your payment. If your bank shows a charge, contact the seller with the email you used."}
        </p>
        {slug && (
          <Link href={`/p/${slug}`} className="text-sm font-medium text-neutral-900 underline">
            Back to the offer
          </Link>
        )}
      </main>
    );
  }

  const deliverables = await withOrgScope(order.organizationId, async (tx) => {
    const found = [];
    for (const enrollment of order.enrollments) {
      const d = await loadDeliverable(tx, order.organizationId, enrollment.productId);
      if (d) found.push(d);
    }
    return found;
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="font-medium text-green-900">
          Thank you, {order.buyerName}. Your payment of {formatMoney(order.totalMinor, order.currency)} was received.
        </p>
        <p className="mt-1 text-sm text-green-800">
          Bookmark this page — this private link is how you get back to your purchase. Anyone with the link can open
          it, so don&apos;t share it.
        </p>
      </div>

      {deliverables.map((d) => (
        <article key={d.productId} className="mb-12">
          <div className="mb-6 flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-neutral-900">{d.title}</h1>
            <a
              href={`/api/access/${encodeURIComponent(token)}/download`}
              className="shrink-0 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Download
            </a>
          </div>

          {d.format === "course"
            ? d.modules.map((mod, i) => (
                <section key={i} className="mb-8">
                  <h2 className="mb-3 text-lg font-semibold text-neutral-900">
                    Module {i + 1}: {mod.title}
                  </h2>
                  <div className="space-y-5">
                    {mod.lessons.map((lesson, j) => (
                      <div key={j}>
                        <h3 className="mb-1 font-medium text-neutral-800">{lesson.title}</h3>
                        <p className="mb-2 whitespace-pre-wrap text-neutral-700">{lesson.content}</p>
                        <p className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-600">
                          <strong>Exercise:</strong> {lesson.exercise}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            : d.sections.map((s, i) => (
                <section key={i} className="mb-8">
                  <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                    {d.format === "ebook" ? `Chapter ${i + 1}` : `Item ${i + 1}`}: {s.title}
                  </h2>
                  <p className="whitespace-pre-wrap text-neutral-700">{s.content}</p>
                </section>
              ))}
        </article>
      ))}
    </main>
  );
}
