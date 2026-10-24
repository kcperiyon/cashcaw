import type { ChargeInput, ChargeResult, PaymentProvider, VerifyInput, VerifyResult } from "./provider";

/**
 * Development-only provider. charge() sends the buyer to /checkout/mock, whose
 * Pay / Fail buttons record an outcome on the transaction (see
 * /api/payments/mock/complete); verify() just reads that recorded outcome.
 * Exercises the real order → transaction → enrollment path with no money and
 * no keys. Never selectable in production (see getPaymentProvider()).
 */
export const mockProvider: PaymentProvider = {
  id: "mock",

  async charge(input: ChargeInput): Promise<ChargeResult> {
    return { redirectUrl: `${input.origin}/checkout/mock?token=${encodeURIComponent(input.orderToken)}` };
  },

  async verify(input: VerifyInput): Promise<VerifyResult> {
    const outcome = (input.rawJson as { mockOutcome?: string } | null)?.mockOutcome;
    return {
      status: outcome === "success" ? "succeeded" : outcome === "fail" ? "failed" : "pending",
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  },
};
