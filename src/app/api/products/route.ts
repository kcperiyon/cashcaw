import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { withOrgScope } from "@/lib/tenant-db";
import { getBusinessAIProvider } from "@/lib/ai";

const CreateSchema = z.object({ opportunityId: z.string().min(1) });

/** Lists this org's products, newest first. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const products = await withOrgScope(user.organizationId, (tx) =>
    tx.product.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
    })
  );
  return NextResponse.json({ products });
}

/**
 * The Product Blueprint step: takes an Opportunity the founder chose, asks
 * the AI provider which of the three formats fits it, and creates a draft
 * Product row with that outline. Also marks the opportunity selected —
 * building from it IS the act of selecting it.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { opportunityId } = parsed.data;

  const opportunity = await withOrgScope(user.organizationId, (tx) =>
    tx.opportunity.findFirst({ where: { id: opportunityId, organizationId: user.organizationId } })
  );
  if (!opportunity) {
    return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
  }

  let blueprint;
  try {
    blueprint = await getBusinessAIProvider().generateProductBlueprint({
      opportunity: { title: opportunity.title, audience: opportunity.audience, problem: opportunity.problem },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate a product blueprint right now.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const product = await withOrgScope(user.organizationId, async (tx) => {
    await tx.opportunity.updateMany({
      where: { id: opportunityId, organizationId: user.organizationId },
      data: { status: "selected" },
    });
    return tx.product.create({
      data: {
        organizationId: user.organizationId,
        opportunityId,
        format: blueprint.format,
        formatReason: blueprint.formatReason,
        title: opportunity.title,
        audience: blueprint.audience,
        transformation: blueprint.transformation,
        outlineJson: blueprint.outline,
      },
    });
  });

  return NextResponse.json({ product });
}
