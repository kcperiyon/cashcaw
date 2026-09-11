import Anthropic from "@anthropic-ai/sdk";
import type {
  BusinessAIProvider,
  InterviewTurnInput,
  InterviewTurnOutput,
  OpportunityInput,
  OpportunityOutput,
} from "@/lib/ai/provider";

const INTERVIEW_TURN_TOOL = {
  name: "interview_turn",
  description: "The interviewer's next message to the founder, plus any concrete new facts about their expertise.",
  input_schema: {
    type: "object" as const,
    properties: {
      message: {
        type: "string",
        description:
          "The next interview question or acknowledgement, in a warm, curious, conversational voice — never a form. Ask about ONE thing at a time: what they've spent years learning, what problems people repeatedly ask them to solve, what results they've personally achieved, who already comes to them for help.",
      },
      extractedFacts: {
        type: "array",
        items: { type: "string" },
        description: "Concrete, specific facts about the founder's expertise/experience/results extracted from their last message. Empty array if nothing new and concrete was said.",
      },
    },
    required: ["message", "extractedFacts"],
  },
};

const PROPOSE_OPPORTUNITIES_TOOL = {
  name: "propose_opportunities",
  description: "5-10 scored digital-product business opportunities grounded in the founder's actual expertise facts.",
  input_schema: {
    type: "object" as const,
    properties: {
      opportunities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            audience: { type: "string", description: "Specific, not generic — e.g. 'busy executives losing weight' not 'people who want fitness'." },
            problem: { type: "string" },
            demandScore: { type: "integer", description: "0-100. Must be grounded in demandEvidence, never a bare guess." },
            demandEvidence: { type: "string", description: "The specific signal behind demandScore — a real competitor, a real search/marketplace pattern. If you have none, say so explicitly and score conservatively." },
            expertiseFitScore: { type: "integer", description: "0-100. How directly this opportunity maps to the founder's OWN stated expertise facts, not general plausibility." },
            competitionDensity: { type: "integer", description: "0-100. HIGHER means MORE crowded/competitive — do not invert this yourself, the caller does." },
            competitionEvidence: { type: "string" },
            monetisationScore: { type: "integer", description: "0-100. How clearly and how much a buyer would pay for this specific transformation." },
          },
          required: ["title", "audience", "problem", "demandScore", "demandEvidence", "expertiseFitScore", "competitionDensity", "competitionEvidence", "monetisationScore"],
        },
      },
    },
    required: ["opportunities"],
  },
};

export class ClaudeBusinessProvider implements BusinessAIProvider {
  readonly id = "claude";
  private client: Anthropic;
  private model: string;

  // `||` not `??`: an env var present but set to "" must fall through to the
  // default too, not stick as "" — see the Closa CLOSA_CLAUDE_MODEL bug this
  // exact pattern was fixed for.
  constructor(apiKey: string = process.env.ANTHROPIC_API_KEY || "", model = process.env.CASHCAW_CLAUDE_MODEL || "claude-sonnet-5") {
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local — see .env.example. Never hardcode it.");
    }
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generateInterviewTurn(input: InterviewTurnInput): Promise<InterviewTurnOutput> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 600,
      system:
        "You are conducting an Expertise Interview for a founder building a digital-product business. Your only job right now is discovery: knowledge, market, and authority questions, one at a time. Never propose a product or business idea in this turn — that happens later, in a separate step.",
      tools: [INTERVIEW_TURN_TOOL],
      tool_choice: { type: "tool", name: "interview_turn" },
      messages: [
        ...input.history.map((m) => ({
          role: (m.role === "founder" ? "user" : "assistant") as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: input.founderMessage },
      ],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not return an interview_turn tool call.");
    }
    return toolUse.input as InterviewTurnOutput;
  }

  async proposeOpportunities(input: OpportunityInput): Promise<OpportunityOutput> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 3000,
      system: [
        "You are proposing digital-product business opportunities for a specific founder, grounded ONLY in the expertise facts given below — never generic ideas a founder with any background could have proposed.",
        "",
        `FOUNDER'S EXPERTISE FACTS:\n${input.expertiseFacts.map((f) => `- ${f}`).join("\n")}`,
        input.targetAudienceHint ? `\nFOUNDER'S STATED AUDIENCE INTEREST: ${input.targetAudienceHint}` : "",
        "",
        "Propose 5-10 opportunities. You are scoring sub-factors, not the overall rank — the caller weights and orders them per docs/business-methodology.md. Do not pad demandScore or monetisationScore without real evidence; a low, honestly-evidenced score is more useful than an inflated guess.",
      ].join("\n"),
      tools: [PROPOSE_OPPORTUNITIES_TOOL],
      tool_choice: { type: "tool", name: "propose_opportunities" },
      messages: [{ role: "user", content: "Propose the opportunities now." }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not return a propose_opportunities tool call.");
    }
    return toolUse.input as OpportunityOutput;
  }
}
