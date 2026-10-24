import type { ChargeInput, ChargeResult, PaymentProvider, VerifyInput, VerifyResult } from "./provider";

// Flutterwave v3 hosted checkout (the portfolio stays on v3). charge() creates
// a hosted payment link; verify() re-queries by our own tx_ref so a forged
// redirect can't mark anything paid. NOT yet exercised against the live API:
// it needs the account's TEST keys.

const BASE = "https://api.flutterwave.com/v3";

function secretKey(): string {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new Error("Flutterwave is not configured (FLUTTERWAVE_SECRET_KEY is empty).");
  return key;
}

export const flutterwaveProvider: PaymentProvider = {
  id: "flutterwave",

  async charge(input: ChargeInput): Promise<ChargeResult> {
    const res = await fetch(`${BASE}/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref: input.reference,
        amount: input.amountMinor / 100,
        currency: input.currency,
        // The token rides in our own query string; whatever Flutterwave appends
        // (status, tx_ref, transaction_id, sometimes a resp=<JSON> blob) is
        // ignored — the callback re-verifies server-side.
        redirect_url: `${input.origin}/api/payments/callback?token=${encodeURIComponent(input.orderToken)}`,
        customer: { email: input.buyerEmail, name: input.buyerName },
        customizations: { title: input.description.slice(0, 60) },
      }),
    });
    const body = (await res.json().catch(() => null)) as {
      status?: string;
      data?: { link?: string };
      message?: string;
    } | null;
    if (!res.ok || body?.status !== "success" || !body.data?.link) {
      throw new Error(body?.message ?? "Could not start the payment.");
    }
    return { redirectUrl: body.data.link, rawJson: body };
  },

  async verify(input: VerifyInput): Promise<VerifyResult> {
    const res = await fetch(
      `${BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(input.providerRef)}`,
      { headers: { Authorization: `Bearer ${secretKey()}` } }
    );
    const body = (await res.json().catch(() => null)) as {
      status?: string;
      data?: { status?: string; amount?: number; currency?: string };
    } | null;
    // No transaction yet (buyer abandoned the hosted page) reads as pending, not failed.
    if (!res.ok || body?.status !== "success" || !body.data) {
      return { status: "pending", amountMinor: input.amountMinor, currency: input.currency, rawJson: body };
    }
    const state = body.data.status;
    return {
      status: state === "successful" ? "succeeded" : state === "failed" || state === "cancelled" ? "failed" : "pending",
      amountMinor: Math.round((body.data.amount ?? 0) * 100),
      currency: body.data.currency ?? input.currency,
      rawJson: body,
    };
  },
};
