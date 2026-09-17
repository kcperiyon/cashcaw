import { withOrgScope } from "@/lib/tenant-db";
import { getBusinessAIProvider } from "@/lib/ai";
import type { BusinessAIProvider } from "@/lib/ai/provider";

// USD per 1k tokens — approximate, per this account's most recently
// verified pricing (see the published build plan's Economics section).
// VERIFY against Anthropic's current pricing page before relying on these
// for real customer billing — this is a starting point for the metering
// mechanism, not a guarantee of current rates. Mirrors Zeroid's own
// MODEL_PRICING table, reused rather than re-derived.
export const MODEL_PRICING: Record<string, { usdPerKIn: number; usdPerKOut: number }> = {
  "claude-sonnet-5": { usdPerKIn: 0.003, usdPerKOut: 0.015 },
  "claude-opus-5": { usdPerKIn: 0.005, usdPerKOut: 0.025 },
  "claude-haiku-4-5-20251001": { usdPerKIn: 0.001, usdPerKOut: 0.005 },
  "claude-fable-5": { usdPerKIn: 0.01, usdPerKOut: 0.05 },
};

// Per the standing "AI monetization" decision: credit_price = model_cost ×
// 4, 1 credit ≈ 1 standard Sonnet reply, sold at ~$0.04. Pegging 100
// credits per $1 of RAW (pre-markup) cost makes that exact: a typical
// Sonnet reply costs ~$0.01 raw → 1 credit → sold at $0.04. The ×4 lives in
// what a real top-up will eventually charge (Checkout, not built yet), not
// here — this module only meters usage against whatever balance exists.
const CREDITS_PER_USD = 100;

// A generous starter allowance so a new founder can run a real interview,
// generate opportunities, and build at least one product before ever
// needing a top-up — a genuine free-tier balance, not a token gesture.
export const SIGNUP_STARTER_CREDITS = 500;

export function creditsForUsage(model: string, tokensIn: number, tokensOut: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0; // unknown model — don't fabricate a cost
  const usd = (tokensIn / 1000) * pricing.usdPerKIn + (tokensOut / 1000) * pricing.usdPerKOut;
  return Math.max(1, Math.ceil(usd * CREDITS_PER_USD));
}

export async function getWalletBalance(organizationId: string): Promise<number> {
  const wallet = await withOrgScope(organizationId, (tx) => tx.aiCreditWallet.findUnique({ where: { organizationId } }));
  return wallet?.balance ?? 0;
}

/**
 * Runs one AI provider call, metered. Reads the wallet balance FIRST and
 * constructs a degraded (cheaper-model) provider once it's at or below
 * zero — per the standing economics decision, a founder is never hard-
 * blocked mid-generation. Checkout isn't built yet, so today "degraded"
 * just protects margin on usage that can't yet be paid for; once Checkout
 * exists, a real top-up is what brings the balance back above zero.
 *
 * Charges/logs only on success — a failed generation (a bad tool call, a
 * truncation error) shouldn't cost the founder anything, same "don't
 * charge for a call that didn't deliver" principle Zeroid's own
 * meterAiCall() applies.
 */
export async function meterAiCall<T>(
  organizationId: string,
  task: string,
  fn: (provider: BusinessAIProvider) => Promise<T>
): Promise<T> {
  const balance = await getWalletBalance(organizationId);
  const provider = getBusinessAIProvider({ degraded: balance <= 0 });

  const result = await fn(provider);

  const usage = provider.getLastUsage();
  if (usage) {
    const credits = creditsForUsage(usage.model, usage.tokensIn, usage.tokensOut);
    await withOrgScope(organizationId, async (tx) => {
      await tx.aiUsageLog.create({
        data: {
          organizationId,
          task,
          model: usage.model,
          tokensIn: usage.tokensIn,
          tokensOut: usage.tokensOut,
          creditsCharged: credits,
        },
      });
      await tx.aiCreditWallet.update({ where: { organizationId }, data: { balance: { decrement: credits } } });
    });
  }

  return result;
}
