import { ClaudeBusinessProvider } from "@/lib/ai/providers/claude";
import type { BusinessAIProvider } from "@/lib/ai/provider";

export type { BusinessAIProvider } from "@/lib/ai/provider";
export type {
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
} from "@/lib/ai/provider";

/**
 * The only place in the app allowed to decide which provider backs a given
 * request. Always Claude for now — per the standing "no BYOK" decision,
 * any future multi-provider routing (Phase 4) stays an internal cost/margin
 * lever behind this same function, never a customer-supplied key. Callers
 * never construct a provider directly.
 */
export function getBusinessAIProvider(): BusinessAIProvider {
  return new ClaudeBusinessProvider();
}
