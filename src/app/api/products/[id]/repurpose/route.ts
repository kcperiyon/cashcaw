import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/current-user";
import { withOrgScope } from "@/lib/tenant-db";
import { meterAiCall } from "@/lib/ai/metering";
import type { RepurposeAssetType, RepurposeOutput } from "@/lib/ai";

const RepurposeSchema = z.object({
  targetType: z.enum(["lead_magnet", "email_sequence", "social_posts", "webinar_script"]),
});

/**
 * Condenses a product's ACTUAL content into a bounded-length summary so a
 * repurposed asset is grounded in real specifics, not just the blueprint's
 * title/audience/transformation. Capped per-item and overall so a large
 * course doesn't balloon the prompt (and cost) regardless of size — this
 * is a summary for grounding, not a full reproduction of the source.
 */
function buildContentSummary(product: {
  format: string;
  modules: { title: string; lessons: { title: string; content: string }[] }[];
  sections: { title: string; content: string }[];
}): string {
  const EXCERPT_LEN = 300;
  const MAX_TOTAL = 6000;
  const lines: string[] = [];

  if (product.format === "course") {
    for (const mod of product.modules) {
      lines.push(`Module: ${mod.title}`);
      for (const lesson of mod.lessons) {
        lines.push(`- ${lesson.title}: ${lesson.content.slice(0, EXCERPT_LEN)}`);
      }
    }
  } else {
    for (const section of product.sections) {
      lines.push(`- ${section.title}: ${section.content.slice(0, EXCERPT_LEN)}`);
    }
  }

  const joined = lines.join("\n");
  return joined.length > MAX_TOTAL ? joined.slice(0, MAX_TOTAL) + "\n[...truncated for length]" : joined;
}

function titleFor(output: RepurposeOutput): string {
  switch (output.targetType) {
    case "lead_magnet":
      return output.leadMagnet.title;
    case "email_sequence":
      return `Email sequence (${output.emailSequence.emails.length} emails)`;
    case "social_posts":
      return `Social posts (${output.socialPosts.posts.length} posts)`;
    case "webinar_script":
      return output.webinarScript.title;
  }
}

function contentFor(output: RepurposeOutput): unknown {
  switch (output.targetType) {
    case "lead_magnet":
      return output.leadMagnet;
    case "email_sequence":
      return output.emailSequence;
    case "social_posts":
      return output.socialPosts;
    case "webinar_script":
      return output.webinarScript;
  }
}

/** Lists this product's repurposed assets, newest first. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;

  const assets = await withOrgScope(user.organizationId, (tx) =>
    tx.repurposedAsset.findMany({
      where: { productId: id, organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
    })
  );
  return NextResponse.json({ assets });
}

/**
 * Generates one new repurposed asset from the product's real content.
 * Appends rather than replaces — see the schema comment on
 * RepurposedAsset for why regeneration here means "add another," unlike
 * Offer/content where it means "start over."
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = RepurposeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const targetType: RepurposeAssetType = parsed.data.targetType;

  const product = await withOrgScope(user.organizationId, (tx) =>
    tx.product.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { modules: { include: { lessons: true } }, sections: true },
    })
  );
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  if (product.status !== "generated") {
    return NextResponse.json({ error: "Generate the product's content before repurposing it." }, { status: 400 });
  }

  let output: RepurposeOutput;
  try {
    output = await meterAiCall(user.organizationId, "repurpose_asset", (provider) =>
      provider.generateRepurposedAsset({
        sourceTitle: product.title,
        sourceAudience: product.audience,
        sourceTransformation: product.transformation,
        sourceContentSummary: buildContentSummary(product),
        targetType,
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not repurpose this product right now.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const asset = await withOrgScope(user.organizationId, (tx) =>
    tx.repurposedAsset.create({
      data: {
        organizationId: user.organizationId,
        productId: id,
        type: targetType,
        title: titleFor(output),
        contentJson: contentFor(output) as Prisma.InputJsonValue,
      },
    })
  );

  return NextResponse.json({ asset });
}
