import { ClaudeBusinessProvider } from "@/lib/ai/providers/claude";
import type { BusinessAIProvider } from "@/lib/ai/provider";

export type { BusinessAIProvider } from "@/lib/ai/provider";
export type {
  AiUsage,
  InterviewTurnInput,
  InterviewTurnOutput,
  OpportunityInput,
  OpportunityOutput,
  BlueprintInput,
  BlueprintOutput,
  ContentInput,
  ContentOutput,
  ProductFormat,
  OfferInput,
  OfferOutput,
  SalesPageInput,
  SalesPageOutput,
  PriceTier,
  RepurposeAssetType,
  RepurposeInput,
  RepurposeOutput,
  LeadMagnetOutput,
  EmailSequenceOutput,
  SocialPostsOutput,
  WebinarScriptOutput,
} from "@/lib/ai/provider";

// Cheap fallback model used only when an org's credit wallet is at or below
// zero — per the standing economics decision, a founder is never hard-
// blocked mid-generation, they just get a cheaper model until they top up.
// Checkout isn't built yet (needs the deferred Flutterwave account), so for
// now "degraded" just protects margin on usage that can't yet be paid for.
const DEGRADED_MODEL = "claude-haiku-4-5-20251001";

/**
 * The only place in the app allowed to decide which provider backs a given
 * request. Always Claude for now — per the standing "no BYOK" decision,
 * any future multi-provider routing (Phase 4) stays an internal cost/margin
 * lever behind this same function, never a customer-supplied key. Callers
 * never construct a provider directly.
 */
export function getBusinessAIProvider(opts?: { degraded?: boolean }): BusinessAIProvider {
  if (opts?.degraded) {
    return new ClaudeBusinessProvider(undefined, DEGRADED_MODEL);
  }
  return new ClaudeBusinessProvider();
}
