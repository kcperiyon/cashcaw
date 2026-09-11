// The swap boundary (see docs/business-methodology.md). Every AI provider
// Cashcaw ever adds implements exactly this interface. Nothing outside
// src/lib/ai/ is allowed to import a provider SDK directly — it goes
// through this contract or it doesn't ship. Mirrors the shape of Closa's
// SalesAIProvider, generalized to Cashcaw's own capabilities, extended one
// phase-slice at a time rather than speculatively.
//
// Phase 1 slice 1 added the Expertise Interview + Opportunity Finder.
// Phase 1 slice 2 (this pass) adds the Product Factory: turning a selected
// Opportunity into an actual course/ebook/template-pack, format chosen by
// the AI from the opportunity itself, not the founder guessing.

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
