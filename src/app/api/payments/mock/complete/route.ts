import { NextResponse } from "next/server";
import { z } from "zod";
import { getPaymentProvider } from "@/lib/payments";
import { settleOrder } from "@/lib/payments/settle";
import { withOrderScope } from "@/lib/tenant-db";

const bodySchema = z.object({ token: z.string().min(10).max(200), outcome: z.enum(["success", "fail"]) });

/**
 * Development only: records the outcome the "mock provider" checkout page's
 * buttons chose, then settles through the same path a real provider callback
 * takes. Answers 404 unless the active provider is the mock — which
 * getPaymentProvider() refuses to select in production.
 */
export async function POST(request: Request) {
  let providerId: string;
  try {
    providerId = getPaymentProvider().id;
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (providerId !== "mock") return NextResponse.json({ error: "Not found." }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const { token, outcome } = parsed.data;

  const recorded = await withOrderScope({ token }, async (tx) => {
    const order = await tx.order.findUnique({
      where: { accessToken: token },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const txn = order?.transactions[0];
    if (!order || !txn) return false;
    if (order.status === "pending") {
      await tx.paymentTransaction.update({ where: { id: txn.id }, data: { rawJson: { mockOutcome: outcome } } });
    }
    return true;
  });
  if (!recorded) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const result = await settleOrder(token);
  return NextResponse.json({ result });
}
