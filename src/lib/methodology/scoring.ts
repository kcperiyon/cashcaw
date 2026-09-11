import type { ProposedOpportunity } from "@/lib/ai/provider";

// Implements docs/business-methodology.md §2 exactly. This is the one rule
// that matters most, structurally enforced rather than left to model
// judgment — a provider may propose the four sub-scores, but the weighting
// and the final overallScore are always computed here, never taken from
// the model's own arithmetic. Same discipline as Closa's
// weightedOverallScore()/assessQualificationAccuracy().
export const OPPORTUNITY_WEIGHTS = {
  demand: 0.3,
  expertiseFit: 0.3,
  competition: 0.2, // applied to (100 - competitionDensity), see below
  monetisation: 0.2,
} as const;

export interface ScoredOpportunity extends ProposedOpportunity {
  overallScore: number;
}

export function scoreOpportunity(o: ProposedOpportunity): ScoredOpportunity {
  const competitionOpenness = 100 - o.competitionDensity;
  const overallScore = Math.round(
    o.demandScore * OPPORTUNITY_WEIGHTS.demand +
      o.expertiseFitScore * OPPORTUNITY_WEIGHTS.expertiseFit +
      competitionOpenness * OPPORTUNITY_WEIGHTS.competition +
      o.monetisationScore * OPPORTUNITY_WEIGHTS.monetisation
  );
  return { ...o, overallScore };
}

export function scoreOpportunities(opportunities: ProposedOpportunity[]): ScoredOpportunity[] {
  return opportunities.map(scoreOpportunity).sort((a, b) => b.overallScore - a.overallScore);
}
