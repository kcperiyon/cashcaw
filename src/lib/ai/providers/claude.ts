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
  OpportunityInput,
  OpportunityOutput,
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
// `looseStringArray` specifically recovers the exact failure mode observed:
// a comma-separated, quoted list missing its outer `[`/`]`. If recovery
// still doesn't produce a clean array, it fails loudly (a 502 the founder
// can retry) rather than silently writing bad data — same principle as the
// rollback-on-ingest-failure logic in the knowledge route.
const looseStringArray = z.preprocess((val) => {
  if (Array.isArray(val)) return val;
  if (typeof val !== "string") return val;
  const trimmed = val.trim();

  if (trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through to the re-wrap attempt below
    }
  }

  // The actual observed failure mode: the outer `["` and `"]` of a real
  // JSON array got stripped, leaving a comma-separated, quoted-in-the-
  // middle list with NEITHER end quoted — e.g. `Foo", "Bar", "Baz`. A bare
  // `[...]` wrap still fails to parse (the first/last items are missing
  // their quote), so re-add the quotes specifically, not just the brackets.
  try {
    return JSON.parse(`["${trimmed}"]`);
  } catch {
    return [trimmed];
  }
}, z.array(z.string()).min(1));

const InterviewTurnSchema = z.object({
  message: z.string(),
  extractedFacts: z.array(z.string()),
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
const OpportunityOutputSchema = z.object({ opportunities: z.array(ProposedOpportunitySchema) });

const BlueprintOutputSchema = z.object({
  format: z.enum(["course", "ebook", "template"]),
  formatReason: z.string(),
  audience: z.string(),
  transformation: z.string(),
  outline: looseStringArray,
});

const CourseContentSchema = z.object({
  modules: z.array(
    z.object({
      title: z.string(),
      lessons: z.array(z.object({ title: z.string(), content: z.string(), exercise: z.string() })),
    })
  ),
});

const FlatContentSchema = z.object({
  sections: z.array(z.object({ title: z.string(), content: z.string() })),
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
    // A real live run during this project's own build hit max_tokens mid-
    // generation on an 8-module course (each lesson's script + exercise
    // adds up fast) and returned a truncated, unparseable tool call — the
    // zod validation above correctly rejected it, but as a confusing
    // "expected array, received undefined" rather than the actual cause.
    // Fixed two ways: a much larger budget for the course branch (the only
    // one with real risk of exceeding 8k — flat formats are one level, not
    // two), and an explicit length cap in the instructions so quality
    // content doesn't quietly balloon into an essay per lesson. If it still
    // truncates, checkTruncation() below turns that into a clear, actionable
    // error instead of a confusing schema-validation failure.
    const formatGuidance: Record<ContentInput["format"], string> = {
      course:
        "Write real teaching content for each lesson — the actual script, not an outline of one — plus one concrete exercise per lesson. Keep each lesson's script to roughly 150-300 words: substantive, not padded.",
      ebook: "Write the actual chapter text, finished prose the reader could read straight through — not a summary of what the chapter would say.",
      template: "Write the actual reusable tool for each item — a real checklist, a real fill-in-the-blank script, a real worksheet structure — something the buyer directly uses, not a description of one.",
    };

    const system = [
      `Write the FULL content for a ${input.format} titled "${input.title}".`,
      `AUDIENCE: ${input.audience}`,
      `TRANSFORMATION: ${input.transformation}`,
      `OUTLINE (write content for every one of these, in this order): ${input.outline.join(" | ")}`,
      formatGuidance[input.format],
    ].join("\n");

    const checkTruncation = (response: Anthropic.Message) => {
      if (response.stop_reason === "max_tokens") {
        throw new Error(
          "Content generation ran out of room before finishing — the outline may be too long for one pass. Try again, or generate a shorter outline."
        );
      }
    };

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
      max_tokens: 8000,
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
}
