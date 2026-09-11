# Cashcaw business methodology

This is the proprietary layer the product is actually worth paying for —
not the AI model. Per the standing decision in the published build plan
("AI monetization" / "Product scope"), this logic lives here and in
`src/lib/methodology/` as typed rules and weights, never inside a
model-specific prompt. Swapping the underlying AI provider must never
require rewriting this document.

This mirrors the pattern already proven on Closa
(`docs/sales-intelligence-framework.md` + `src/lib/sales/scoring-rubric.ts`):
the framework is data the AI is asked to apply, not something the AI is
trusted to invent fresh each time.

## 1. The Unique Value Zone

A commercially viable opportunity sits at the intersection of three things,
all of which must be true — not just one:

- **Expertise fit** — does the founder actually have real, demonstrable
  knowledge or results here, not just interest?
- **Market pain** — is there a real, currently-unsolved (or badly-solved)
  problem a specific audience already spends time or money trying to fix?
- **Monetisable transformation** — is there a concrete before/after state a
  buyer would pay to move between, not just "information transfer"?

An opportunity missing any one of these is not a Unique Value Zone match,
regardless of how strong the other two are. The Expertise Interview
(Phase 1) exists to surface candidates; the scoring below is what actually
ranks them.

## 2. Opportunity scoring weights

Every opportunity gets four sub-scores, 0–100 each, combined into one
overall score. These weights are the actual rule — an AI call may propose
sub-scores, but the weighting and the final number are computed here, in
code, the same way Closa's `weightedOverallScore()` is never left to the
model to compute itself.

| Factor | Weight | What it measures |
|---|---|---|
| Demand | 30% | Real, current evidence of people spending time/money trying to solve this — not a hunch. |
| Expertise fit | 30% | How directly the founder's own demonstrated knowledge/results map to this specific opportunity. |
| Competition | 20% | Scored inversely — a crowded, well-served space scores low here, not high. |
| Monetisation potential | 20% | How clearly a buyer would pay, and how much, for the specific transformation on offer. |

```
overallScore = demand*0.30 + expertiseFit*0.30 + (100 - competitionDensity)*0.20 + monetisation*0.20
```

An opportunity must carry **real evidence** behind at least the demand and
competition sub-scores (a specific competitor, a specific search/marketplace
signal) — a sub-score with no cited evidence is not allowed to be presented
as ranked fact to the user; it must be flagged as an estimate.

## 3. Product-readiness rubric

Before a generated product is shown to its creator as "ready," it is
scored against the same structural pattern Closa uses for
`assessQualificationAccuracy()`: one non-negotiable dimension is
**computed from ground truth, never taken from the model's own
self-report** — because letting the model grade its own homework on the one
dimension that matters most is exactly the failure mode Closa's rubric was
built to prevent.

| Dimension | Who scores it |
|---|---|
| Problem intensity | Model-proposed, evidence-checked |
| Differentiation | Model-proposed, evidence-checked |
| Offer strength | Model-proposed |
| Audience clarity | Model-proposed |
| **Format-transformation fit** | **Computed, not model-proposed** — a course promising a "quick win" outcome, or an ebook promising a "hands-on practice" outcome, is a real structural mismatch regardless of how good the copy reads. This check is a rule, not a judgment call. |

## 4. What this document does not cover yet

Offer construction (pricing tiers, guarantees), sales-page positioning
scoring, and the video-format economics guardrail all get their own typed
modules once Phase 1/2 actually builds them — this file only covers what
Phase 0 and Phase 1's Opportunity Finder need today. Extend it additively,
the same "never rewrite history" discipline already used elsewhere in the
portfolio (e.g. Mongozutu's Rules Engine) — old scoring runs should stay
explainable by the weights that were actually in effect when they ran.
