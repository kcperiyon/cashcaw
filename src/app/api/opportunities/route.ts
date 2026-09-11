import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { withOrgScope } from "@/lib/tenant-db";
import { getBusinessAIProvider } from "@/lib/ai";
import { scoreOpportunities } from "@/lib/methodology/scoring";

/** Lists this org's opportunities, highest-scored first. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const opportunities = await withOrgScope(user.organizationId, (tx) =>
    tx.opportunity.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { overallScore: "desc" },
    })
  );
  return NextResponse.json({ opportunities });
}

/**
 * The Opportunity Finder: reads every ExpertiseFact gathered so far, asks
 * the AI provider to propose candidates, and — critically — computes
 * overallScore itself via scoreOpportunities() rather than trusting
 * whatever the model returned. Each run's results are ADDED, not replacing
 * prior runs, since re-interviewing later should surface new opportunities
 * without silently discarding earlier ones a founder may still be
 * considering.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const facts = await withOrgScope(user.organizationId, (tx) =>
    tx.expertiseFact.findMany({ where: { organizationId: user.organizationId } })
  );
  if (facts.length === 0) {
    return NextResponse.json(
      { error: "No expertise facts yet — complete a few interview turns first." },
      { status: 400 }
    );
  }

  let proposed;
  try {
    proposed = await getBusinessAIProvider().proposeOpportunities({
      expertiseFacts: facts.map((f) => f.content),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate opportunities right now.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const scored = scoreOpportunities(proposed.opportunities);

  const created = await withOrgScope(user.organizationId, (tx) =>
    Promise.all(
      scored.map((o) =>
        tx.opportunity.create({
          data: {
            organizationId: user.organizationId,
            title: o.title,
            audience: o.audience,
            problem: o.problem,
            demandScore: o.demandScore,
            demandEvidence: o.demandEvidence,
            expertiseFitScore: o.expertiseFitScore,
            competitionDensity: o.competitionDensity,
            competitionEvidence: o.competitionEvidence,
            monetisationScore: o.monetisationScore,
            overallScore: o.overallScore,
          },
        })
      )
    )
  );

  return NextResponse.json({ opportunities: created.sort((a, b) => b.overallScore - a.overallScore) });
}
