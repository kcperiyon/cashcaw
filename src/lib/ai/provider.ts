// The swap boundary (see docs/business-methodology.md). Every AI provider
// Cashcaw ever adds implements exactly this interface. Nothing outside
// src/lib/ai/ is allowed to import a provider SDK directly — it goes
// through this contract or it doesn't ship. Mirrors the shape of Closa's
// SalesAIProvider, generalized to Cashcaw's own capabilities, extended one
// phase-slice at a time rather than speculatively.
//
// Phase 1 slice 1 added the Expertise Interview + Opportunity Finder.
// Phase 1 slice 2 added the Product Factory. Phase 1 slice 3 added the
// Offer Builder + Sales Page generator. Phase 1 slice 4 added AI-credit
// metering. Phase 2 slice 1 (this pass) adds the Repurposing Engine — the
// part of Phase 2 that doesn't need a real purchase to exist yet (order
// bump/upsell/ascension and video generation all wait on Checkout or a new
// third-party video account, neither set up).

export interface AiUsage {
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export interface BusinessAIProvider {
  readonly id: string;

  /**
   * Produce the interviewer's next question/response given the conversation
   * so far, and any concrete facts newly extracted from what the founder
   * just said. Facts get written into the founder's Expertise Graph
   * (KnowledgeSource) by the caller — the provider never writes to the
   * database directly.
   */
  generateInterviewTurn(input: InterviewTurnInput): Promise<InterviewTurnOutput>;

  /**
   * Propose scored opportunity candidates from the founder's accumulated
   * expertise facts. The provider proposes sub-scores and evidence; the
   * caller ALWAYS recomputes the weighted overall score itself per
   * docs/business-methodology.md §2 — never trusts a model-returned overall
   * score, the same "structural override" discipline Closa applies to
   * qualificationAccuracy.
   */
  proposeOpportunities(input: OpportunityInput): Promise<OpportunityOutput>;

  /**
   * The Product Blueprint step: given a selected opportunity, picks which
   * of the three Phase 1 formats fits it best (course needs a multi-step
   * skill; ebook needs a single-sitting insight/reframe; template needs a
   * checklist/tool, not narrative) and outlines it. Caller enforces the
   * "format-transformation fit" rule from docs/business-methodology.md §3
   * before treating this as final, not just displaying it as-is.
   */
  generateProductBlueprint(input: BlueprintInput): Promise<BlueprintOutput>;

  /**
   * The actual content generation for whichever format the blueprint
   * picked. One call, one of three response shapes — never three separate
   * bespoke provider methods for what is fundamentally the same task
   * (turn an outline into real content) with a different final render.
   */
  generateProductContent(input: ContentInput): Promise<ContentOutput>;

  /**
   * Builds the commercial offer around a generated product: the promise,
   * the mechanism (why this specific approach works), bonuses, a guarantee,
   * and three price tiers. One offer per product — this is deliberately not
   * re-run per sales-page variant, since the underlying deal doesn't change
   * with positioning, only how it's framed.
   */
  generateOffer(input: OfferInput): Promise<OfferOutput>;

  /**
   * Three sales-page variants, each a different honest positioning angle on
   * the SAME offer (outcome-driven / pain-driven / identity-driven), not
   * three different offers. clarityScore is the AI's own subjective
   * judgment of how clearly this variant's promise lands for the stated
   * audience — deliberately NOT a weighted formula like opportunity
   * scoring, since sales-copy quality has no equivalent objective inputs to
   * weight. Presenting it as anything more precise than "the model's own
   * read" would be false rigor.
   */
  generateSalesPages(input: SalesPageInput): Promise<SalesPageOutput>;

  /**
   * Turns an existing product's ACTUAL content into a different downstream
   * asset — a lead magnet, an email sequence, a batch of social posts, or a
   * webinar script — grounded in a real summary of the source content
   * (see the caller's buildContentSummary()), not just the product's
   * title/audience/transformation. One IP → many assets, per the standing
   * "Product Repurposer" vision — one provider method with a discriminated
   * output, same pattern as generateProductContent().
   */
  generateRepurposedAsset(input: RepurposeInput): Promise<RepurposeOutput>;

  /**
   * Token usage from the most recently completed generate*() call on this
   * provider INSTANCE, or null before any call has run. A fresh provider
   * is constructed per request (see getBusinessAIProvider()), so there's
   * no cross-request leakage — this is a request-scoped side channel for
   * metering, not shared state. Every provider must report this, since
   * credit metering is a real product requirement independent of which
   * model backs a given account.
   */
  getLastUsage(): AiUsage | null;
}

export interface InterviewTurnInput {
  history: { role: "founder" | "interviewer"; content: string }[];
  founderMessage: string;
}

export interface InterviewTurnOutput {
  message: string;
  extractedFacts: string[];
}

export interface OpportunityInput {
  expertiseFacts: string[];
  targetAudienceHint?: string;
}

export interface ProposedOpportunity {
  title: string;
  audience: string;
  problem: string;
  /** 0-100, model-proposed, evidence-checked per docs/business-methodology.md §2. */
  demandScore: number;
  demandEvidence: string;
  expertiseFitScore: number;
  /** 0-100, HIGHER = MORE competition — the caller inverts this when computing overallScore. */
  competitionDensity: number;
  competitionEvidence: string;
  monetisationScore: number;
}

export interface OpportunityOutput {
  opportunities: ProposedOpportunity[];
}

export type ProductFormat = "course" | "ebook" | "template";

export interface BlueprintInput {
  opportunity: { title: string; audience: string; problem: string };
}

export interface BlueprintOutput {
  format: ProductFormat;
  formatReason: string;
  audience: string;
  transformation: string;
  /** Titles only — module/chapter/item titles, in order. Content comes from generateProductContent(). */
  outline: string[];
}

export interface ContentInput {
  format: ProductFormat;
  title: string;
  audience: string;
  transformation: string;
  outline: string[];
}

export interface CourseLesson {
  title: string;
  content: string;
  exercise: string;
}
export interface CourseModule {
  title: string;
  lessons: CourseLesson[];
}
export interface FlatSection {
  title: string;
  content: string;
}

export type ContentOutput =
  | { format: "course"; modules: CourseModule[] }
  | { format: "ebook"; sections: FlatSection[] }
  | { format: "template"; sections: FlatSection[] };

export interface PriceTier {
  name: string;
  price: string;
  description: string;
}

export interface OfferInput {
  title: string;
  audience: string;
  transformation: string;
  outline: string[];
}

export interface OfferOutput {
  promise: string;
  mechanism: string;
  bonuses: string[];
  guaranteeText: string;
  priceTiers: PriceTier[];
}

export interface SalesPageInput {
  title: string;
  audience: string;
  transformation: string;
  offer: OfferOutput;
}

export interface SalesPageCopy {
  problemAgitation: string;
  mechanismExplainer: string;
  whatsIncluded: string;
  bonusesText: string;
  guaranteeText: string;
  faq: { question: string; answer: string }[];
  cta: string;
}

export interface SalesPageVariant {
  positioning: "outcome" | "pain" | "identity";
  headline: string;
  subheadline: string;
  copy: SalesPageCopy;
  /** AI's own subjective read, 0-100 — see generateSalesPages()'s doc comment for why this is never a computed formula. */
  clarityScore: number;
  rationale: string;
}

export interface SalesPageOutput {
  variants: SalesPageVariant[];
}

export type RepurposeAssetType = "lead_magnet" | "email_sequence" | "social_posts" | "webinar_script";

export interface RepurposeInput {
  sourceTitle: string;
  sourceAudience: string;
  sourceTransformation: string;
  /** A condensed, real summary of the source product's actual content (titles + excerpts) — see the caller's buildContentSummary(). Never just the blueprint metadata alone. */
  sourceContentSummary: string;
  targetType: RepurposeAssetType;
}

export interface LeadMagnetOutput {
  title: string;
  body: string;
}

export interface EmailSequenceOutput {
  emails: { subject: string; body: string }[];
}

export interface SocialPostsOutput {
  posts: { platform: string; content: string }[];
}

export interface WebinarScriptOutput {
  title: string;
  sections: { title: string; content: string }[];
}

export type RepurposeOutput =
  | { targetType: "lead_magnet"; leadMagnet: LeadMagnetOutput }
  | { targetType: "email_sequence"; emailSequence: EmailSequenceOutput }
  | { targetType: "social_posts"; socialPosts: SocialPostsOutput }
  | { targetType: "webinar_script"; webinarScript: WebinarScriptOutput };
