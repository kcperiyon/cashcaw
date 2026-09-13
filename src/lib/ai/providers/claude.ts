import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type {
  BusinessAIProvider,
  BlueprintInput,
  BlueprintOutput,
  ContentInput,
  ContentOutput,
  InterviewTurnInput,
  InterviewTurnOutput,
  OfferInput,
  OfferOutput,
  OpportunityInput,
  OpportunityOutput,
  SalesPageInput,
  SalesPageOutput,
} from "@/lib/ai/provider";

// Anthropic's tool-use is USUALLY schema-compliant, not ALWAYS — a real run
// during this project's own build came back with `outline` as a bare,
// bracket-less string instead of a JSON array, and it silently corrupted a
// Postgres jsonb column because the old code trusted `as BlueprintOutput`
// with zero runtime checking. Every tool response is now zod-validated
// before the caller ever sees it — the "structural override" discipline
// this app already applies to overallScore/qualificationAccuracy, extended
// to mean "don't trust the model's SHAPE either, not just its judgment."
//
// `recoverArray` generalizes the recovery after TWO separate real failures
// during this project's own build: `outline` (a string array) came back
// bracket-less AND missing the first/last item's quotes, then later
// `variants` (an array of full objects) came back bracket-less with intact
// internal object syntax. Different malformations need different repairs —
// an object array just needs its `[`/`]` restored; a string array needs the
// quotes re-added too, since stripping `["`/`"]` from a real JSON array
// takes the first and last item's quote marks with it. Tries progressively:
// already-valid array -> parse as-is -> bare bracket wrap -> quote-wrapped
// bracket wrap (string arrays only) -> give up and let the schema below
// reject it loudly rather than silently writing corrupted data — same
// principle as the rollback-on-ingest-failure logic in the knowledge route.
function recoverArray<T extends z.ZodTypeAny>(itemSchema: T, { allowEmpty = false } = {}) {
  return z.preprocess((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val !== "string") return val;
    const trimmed = val.trim();

    // An empty string genuinely means "no items" for fields where that's
    // valid (e.g. extractedFacts on a turn with nothing new) — don't run it
    // through the JSON-recovery attempts below, which would otherwise turn
    // "" into a single garbage element via the final fallback.
    if (allowEmpty && trimmed === "") return [];

    if (trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // fall through
      }
    }
    try {
      return JSON.parse(`[${trimmed}]`);
    } catch {
      // fall through
    }
    try {
      return JSON.parse(`["${trimmed}"]`);
    } catch {
      return [trimmed];
    }
  }, allowEmpty ? z.array(itemSchema) : z.array(itemSchema).min(1));
}

const looseStringArray = recoverArray(z.string());
const looseStringArrayAllowEmpty = recoverArray(z.string(), { allowEmpty: true });

// Shared across every long-generation method (course/flat content, sales
// pages) — any of them can hit max_tokens on a large enough outline/offer,
// which otherwise surfaces as a confusing schema-validation error (a
// half-written object missing most of its fields) rather than the actual
// cause. Call this right after every messages.create() whose output could
// plausibly run long.
function checkTruncation(response: Anthropic.Message) {
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "Content generation ran out of room before finishing — the outline may be too long for one pass. Try again, or generate a shorter outline."
    );
  }
}

const InterviewTurnSchema = z.object({
  message: z.string(),
  extractedFacts: looseStringArrayAllowEmpty,
});

const ProposedOpportunitySchema = z.object({
  title: z.string(),
  audience: z.string(),
  problem: z.string(),
  demandScore: z.number().int(),
  demandEvidence: z.string(),
  expertiseFitScore: z.number().int(),
  competitionDensity: z.number().int(),
  competitionEvidence: z.string(),
  monetisationScore: z.number().int(),
});
const OpportunityOutputSchema = z.object({ opportunities: recoverArray(ProposedOpportunitySchema) });

const BlueprintOutputSchema = z.object({
  format: z.enum(["course", "ebook", "template"]),
  formatReason: z.string(),
  audience: z.string(),
  transformation: z.string(),
  outline: looseStringArray,
});

const CourseContentSchema = z.object({
  modules: recoverArray(
    z.object({
      title: z.string(),
      lessons: recoverArray(z.object({ title: z.string(), content: z.string(), exercise: z.string() })),
    })
  ),
});

const PriceTierSchema = z.object({ name: z.string(), price: z.string(), description: z.string() });

const OfferOutputSchema = z.object({
  promise: z.string(),
  mechanism: z.string(),
  bonuses: looseStringArray,
  guaranteeText: z.string(),
  priceTiers: recoverArray(PriceTierSchema),
});

const SalesPageVariantSchema = z.object({
  positioning: z.enum(["outcome", "pain", "identity"]),
  headline: z.string(),
  subheadline: z.string(),
  copy: z.object({
    problemAgitation: z.string(),
    mechanismExplainer: z.string(),
    whatsIncluded: z.string(),
    bonusesText: z.string(),
    guaranteeText: z.string(),
    faq: recoverArray(z.object({ question: z.string(), answer: z.string() })),
    cta: z.string(),
  }),
  clarityScore: z.number().int().min(0).max(100),
  rationale: z.string(),
});
const SalesPageOutputSchema = z.object({ variants: recoverArray(SalesPageVariantSchema) });

const FlatContentSchema = z.object({
  sections: recoverArray(z.object({ title: z.string(), content: z.string() })),
});

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

const GENERATE_BLUEPRINT_TOOL = {
  name: "generate_blueprint",
  description: "Pick the best product format for this opportunity and outline it.",
  input_schema: {
    type: "object" as const,
    properties: {
      format: {
        type: "string",
        enum: ["course", "ebook", "template"],
        description:
          "course = teaches a multi-step SKILL that takes practice over time (structure, exercises). ebook = delivers a single-sitting INSIGHT or reframe that doesn't need practice to land. template = hands over a reusable TOOL/checklist/script the buyer fills in or follows, not narrative content. Pick based on what the transformation actually requires, not by default to course.",
      },
      formatReason: { type: "string", description: "One sentence: why this format fits the transformation better than the other two." },
      audience: { type: "string" },
      transformation: { type: "string", description: "The specific before-state to after-state this product delivers." },
      outline: {
        type: "array",
        items: { type: "string" },
        description: "5-8 ordered titles — module titles for a course, chapter titles for an ebook, item/tool titles for a template pack.",
      },
    },
    required: ["format", "formatReason", "audience", "transformation", "outline"],
  },
};

const GENERATE_COURSE_CONTENT_TOOL = {
  name: "generate_course_content",
  description: "Full lesson content for every module in the outline.",
  input_schema: {
    type: "object" as const,
    properties: {
      modules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            lessons: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  content: { type: "string", description: "The actual teaching script for this lesson — real content the founder could read/present as-is, not a placeholder." },
                  exercise: { type: "string", description: "One concrete practice exercise tied to this lesson." },
                },
                required: ["title", "content", "exercise"],
              },
            },
          },
          required: ["title", "lessons"],
        },
      },
    },
    required: ["modules"],
  },
};

const GENERATE_FLAT_CONTENT_TOOL = {
  name: "generate_flat_content",
  description: "Full content for every section in the outline (ebook chapters or template items).",
  input_schema: {
    type: "object" as const,
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string", description: "The actual content for this section — real, finished text, not a placeholder or summary of what it should contain." },
          },
          required: ["title", "content"],
        },
      },
    },
    required: ["sections"],
  },
};

const GENERATE_OFFER_TOOL = {
  name: "generate_offer",
  description: "The commercial offer wrapped around this product: promise, mechanism, bonuses, guarantee, and price tiers.",
  input_schema: {
    type: "object" as const,
    properties: {
      promise: { type: "string", description: "The core outcome promise, one or two sentences — what the buyer walks away with." },
      mechanism: { type: "string", description: "Why THIS specific approach delivers the promise, not generic 'proven method' language — the actual reason it works." },
      bonuses: {
        type: "array",
        items: { type: "string" },
        description: "2-4 real bonuses that directly support the transformation — never filler bonuses unrelated to the core promise.",
      },
      guaranteeText: { type: "string", description: "A concrete, specific guarantee — what triggers it and what happens, not vague 'satisfaction guaranteed' language." },
      priceTiers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "string", description: "A real suggested price, e.g. '$97' or '$297' — grounded in what this specific transformation is worth to this audience, not a round default." },
            description: { type: "string" },
          },
          required: ["name", "price", "description"],
        },
        description: "Exactly 3 tiers, ascending price, each genuinely different in scope — not the same offer relabeled.",
      },
    },
    required: ["promise", "mechanism", "bonuses", "guaranteeText", "priceTiers"],
  },
};

const GENERATE_SALES_PAGES_TOOL = {
  name: "generate_sales_pages",
  description: "Three sales-page variants for the SAME offer, each a genuinely different honest positioning angle.",
  input_schema: {
    type: "object" as const,
    properties: {
      variants: {
        type: "array",
        description: "Exactly 3: one 'outcome' (leads with the result), one 'pain' (leads with the problem), one 'identity' (leads with who the buyer becomes).",
        items: {
          type: "object",
          properties: {
            positioning: { type: "string", enum: ["outcome", "pain", "identity"] },
            headline: { type: "string" },
            subheadline: { type: "string" },
            copy: {
              type: "object",
              properties: {
                problemAgitation: { type: "string" },
                mechanismExplainer: { type: "string" },
                whatsIncluded: { type: "string" },
                bonusesText: { type: "string" },
                guaranteeText: { type: "string" },
                faq: {
                  type: "array",
                  items: { type: "object", properties: { question: { type: "string" }, answer: { type: "string" } }, required: ["question", "answer"] },
                  description: "3-5 real objection-handling questions, not generic FAQ filler.",
                },
                cta: { type: "string" },
              },
              required: ["problemAgitation", "mechanismExplainer", "whatsIncluded", "bonusesText", "guaranteeText", "faq", "cta"],
            },
            clarityScore: { type: "integer", description: "0-100, your own honest read of how clearly THIS variant's promise lands for this exact audience — not a formula, your genuine judgment." },
            rationale: { type: "string", description: "One sentence: why this angle does or doesn't land well for this audience." },
          },
          required: ["positioning", "headline", "subheadline", "copy", "clarityScore", "rationale"],
        },
      },
    },
    required: ["variants"],
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
    return InterviewTurnSchema.parse(toolUse.input) satisfies InterviewTurnOutput;
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
    return OpportunityOutputSchema.parse(toolUse.input) satisfies OpportunityOutput;
  }

  async generateProductBlueprint(input: BlueprintInput): Promise<BlueprintOutput> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1200,
      system: [
        "You are a product strategist choosing the right digital-product FORMAT for a specific opportunity, then outlining it.",
        `OPPORTUNITY: ${input.opportunity.title}`,
        `AUDIENCE: ${input.opportunity.audience}`,
        `PROBLEM: ${input.opportunity.problem}`,
        "Don't default to 'course' — pick whichever of course/ebook/template actually fits what this transformation requires (see the tool's format descriptions), and say why.",
      ].join("\n"),
      tools: [GENERATE_BLUEPRINT_TOOL],
      tool_choice: { type: "tool", name: "generate_blueprint" },
      messages: [{ role: "user", content: "Generate the blueprint now." }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not return a generate_blueprint tool call.");
    }
    return BlueprintOutputSchema.parse(toolUse.input) satisfies BlueprintOutput;
  }

  async generateProductContent(input: ContentInput): Promise<ContentOutput> {
    // Real live runs during this project's own build hit max_tokens mid-
    // generation TWICE — once on an 8-module course, and once on an
    // 8-item template pack (scorecards/decision-tools/trackers are each
    // genuinely long; "flat formats are lower risk" was wrong, corrected
    // here). Both returned a truncated, unparseable tool call that zod
    // correctly rejected but as a confusing "expected X, received
    // undefined" rather than the actual cause. Fixed for both branches: a
    // larger shared budget, an explicit length cap in the instructions so
    // quality content doesn't quietly balloon into an essay per item, and
    // checkTruncation() below turns any future overrun into a clear,
    // actionable error instead of a confusing schema-validation failure.
    const formatGuidance: Record<ContentInput["format"], string> = {
      course:
        "Write real teaching content for each lesson — the actual script, not an outline of one — plus one concrete exercise per lesson. Keep each lesson's script to roughly 150-300 words: substantive, not padded.",
      ebook: "Write the actual chapter text, finished prose the reader could read straight through — not a summary of what the chapter would say. Keep each chapter to roughly 200-350 words: substantive, not padded.",
      template: "Write the actual reusable tool for each item — a real checklist, a real fill-in-the-blank script, a real worksheet structure — something the buyer directly uses, not a description of one. Keep each item focused and usable, not an essay — a real tool someone fills in during a single sitting, roughly 150-300 words of instructional text plus whatever structure (checklist/table/fields) the tool itself needs.",
    };

    const system = [
      `Write the FULL content for a ${input.format} titled "${input.title}".`,
      `AUDIENCE: ${input.audience}`,
      `TRANSFORMATION: ${input.transformation}`,
      `OUTLINE (write content for every one of these, in this order): ${input.outline.join(" | ")}`,
      formatGuidance[input.format],
    ].join("\n");

    if (input.format === "course") {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 16000,
        system: system + "\nKeep lessons per module to 2-3 — depth over quantity.",
        tools: [GENERATE_COURSE_CONTENT_TOOL],
        tool_choice: { type: "tool", name: "generate_course_content" },
        messages: [{ role: "user", content: "Write the full course content now." }],
      });
      checkTruncation(response);
      const toolUse = response.content.find((b) => b.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") {
        throw new Error("Claude did not return a generate_course_content tool call.");
      }
      const { modules } = CourseContentSchema.parse(toolUse.input);
      return { format: "course", modules };
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      system,
      tools: [GENERATE_FLAT_CONTENT_TOOL],
      tool_choice: { type: "tool", name: "generate_flat_content" },
      messages: [{ role: "user", content: "Write the full content now." }],
    });
    checkTruncation(response);
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not return a generate_flat_content tool call.");
    }
    const { sections } = FlatContentSchema.parse(toolUse.input);
    return { format: input.format, sections } as ContentOutput;
  }

  async generateOffer(input: OfferInput): Promise<OfferOutput> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1500,
      system: [
        `Build the commercial offer for "${input.title}".`,
        `AUDIENCE: ${input.audience}`,
        `TRANSFORMATION: ${input.transformation}`,
        `WHAT'S ACTUALLY INSIDE: ${input.outline.join(" | ")}`,
        "Ground the price tiers in what THIS transformation is worth to THIS audience — a busy VP paying to fix a retention problem tolerates a different price than an individual coach buying a personal tool. Don't default to generic $27/$97/$297 SaaS-info-product pricing.",
      ].join("\n"),
      tools: [GENERATE_OFFER_TOOL],
      tool_choice: { type: "tool", name: "generate_offer" },
      messages: [{ role: "user", content: "Build the offer now." }],
    });
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not return a generate_offer tool call.");
    }
    return OfferOutputSchema.parse(toolUse.input) satisfies OfferOutput;
  }

  async generateSalesPages(input: SalesPageInput): Promise<SalesPageOutput> {
    // 6000 tokens genuinely wasn't enough here in a real run — 3 full
    // variants (headline/subheadline/6 copy fields/FAQ array each) is
    // comparable in size to an 8-item template pack, which already needed
    // 16000. Same fix as the content-generation methods: bigger budget,
    // explicit length guidance, and checkTruncation() so a future overrun
    // fails clearly instead of as a pile of "expected string, received
    // undefined" errors on whichever variant got cut off mid-object.
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      system: [
        `Write 3 sales-page variants for "${input.title}" — same offer, three honest positioning angles.`,
        `AUDIENCE: ${input.audience}`,
        `TRANSFORMATION: ${input.transformation}`,
        `THE OFFER — promise: ${input.offer.promise}`,
        `MECHANISM: ${input.offer.mechanism}`,
        `BONUSES: ${input.offer.bonuses.join(" | ")}`,
        `GUARANTEE: ${input.offer.guaranteeText}`,
        `PRICE TIERS: ${input.offer.priceTiers.map((t) => `${t.name} (${t.price})`).join(", ")}`,
        "Each variant must be genuinely different in angle, not the same copy relabeled — outcome leads with the result, pain leads with the problem, identity leads with who the buyer becomes.",
        "Keep each copy field focused — a few sentences to a short paragraph, not an essay. Depth of distinctiveness between variants matters more than length within one.",
      ].join("\n"),
      tools: [GENERATE_SALES_PAGES_TOOL],
      tool_choice: { type: "tool", name: "generate_sales_pages" },
      messages: [{ role: "user", content: "Write all 3 variants now." }],
    });
    checkTruncation(response);
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not return a generate_sales_pages tool call.");
    }
    return SalesPageOutputSchema.parse(toolUse.input) satisfies SalesPageOutput;
  }
}
