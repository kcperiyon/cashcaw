// The swap boundary (see docs/business-methodology.md). Every AI provider
// Cashcaw ever adds implements exactly this interface. Nothing outside
// src/lib/ai/ is allowed to import a provider SDK directly — it goes
// through this contract or it doesn't ship. Mirrors the shape of Closa's
// SalesAIProvider, generalized to Cashcaw's own two Phase 1 capabilities.
//
// Started with only what Phase 1 (the Expertise Interview + Opportunity
// Finder) needs — no speculative methods for Product Factory, Offer
// Builder, etc. Those extend this interface only when their phase starts,
// same discipline Closa applied to its own provider.ts.

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
