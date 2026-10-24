import type { Prisma } from "@/generated/prisma/client";
import { getPaymentProvider } from "@/lib/payments";
import { withOrderScope } from "@/lib/tenant-db";

export type SettleOutcome = "paid" | "failed" | "pending" | "not_found";

/**
 * Asks the payment provider what happened to this order's latest payment
 * attempt and applies the answer. The ONLY place an order becomes paid.
 *
 * - Trusts verify() alone: nothing the browser sent (query params, mock
 *   buttons, redirect status) decides the outcome.
 * - Idempotent: a replayed callback, a double-click or a refresh finds the
 *   order already settled and changes nothing (the order row is locked
 *   FOR UPDATE and re-read before any write).
 * - Refuses to credit a payment whose verified amount/currency differ from
 *   the order's — the order is failed instead.
 */
export async function settleOrder(token: string): Promise<SettleOutcome> {
  const snapshot = await withOrderScope({ token }, (tx) =>
    tx.order.findUnique({
      where: { accessToken: token },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 1 } },
    })
  );
  if (!snapshot) return "not_found";
  if (snapshot.status === "paid") return "paid";
  if (snapshot.status !== "pending") return snapshot.status === "failed" ? "failed" : "pending";

  const txn = snapshot.transactions[0];
  if (!txn) return "pending";

  const provider = getPaymentProvider();
  if (provider.id !== txn.provider) {
    throw new Error(`Transaction belongs to provider "${txn.provider}", which is not the active provider.`);
  }
  const result = await provider.verify({
    providerRef: txn.providerRef,
    amountMinor: txn.amountMinor,
    currency: txn.currency,
    rawJson: txn.rawJson,
  });
  if (result.status === "pending") return "pending";

  return withOrderScope({ token }, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${snapshot.id} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: snapshot.id }, include: { lines: true } });
    if (!order) return "not_found";
    if (order.status === "paid") return "paid";
    if (order.status !== "pending") return "failed";

    const raw = (result.rawJson ?? txn.rawJson ?? null) as Prisma.InputJsonValue | null;
    const rawJson = raw === null ? undefined : raw;

    const matches = result.amountMinor === order.totalMinor && result.currency === order.currency;
    if (result.status === "failed" || !matches) {
      await tx.paymentTransaction.update({ where: { id: txn.id }, data: { status: "failed", rawJson } });
      await tx.order.update({ where: { id: order.id }, data: { status: "failed" } });
      return "failed";
    }

    await tx.paymentTransaction.update({ where: { id: txn.id }, data: { status: "succeeded", rawJson } });
    await tx.order.update({ where: { id: order.id }, data: { status: "paid", paidAt: new Date() } });
    await tx.enrollment.createMany({
      data: order.lines.map((line) => ({
        organizationId: order.organizationId,
        orderId: order.id,
        productId: line.productId,
        buyerEmail: order.buyerEmail,
      })),
      skipDuplicates: true,
    });
    return "paid";
  });
}
