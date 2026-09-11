"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";

type Opportunity = {
  id: string;
  title: string;
  audience: string;
  problem: string;
  demandScore: number;
  demandEvidence: string;
  expertiseFitScore: number;
  competitionDensity: number;
  competitionEvidence: string;
  monetisationScore: number;
  overallScore: number;
  status: "proposed" | "selected" | "archived";
};

export function OpportunitiesClient() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/opportunities");
    const body = await res.json();
    setOpportunities(body.opportunities);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const res = await fetch("/api/opportunities", { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Something went wrong." }));
      setError(body.error ?? "Something went wrong.");
      setGenerating(false);
      return;
    }
    setGenerating(false);
    await load();
  }

  async function handleSelect(id: string) {
    await fetch(`/api/opportunities/${id}/select`, { method: "POST" });
    await load();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <AppNav />
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Opportunities</h1>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {generating ? "Finding opportunities…" : "Find opportunities"}
        </button>
      </div>
      <p className="mb-6 text-sm text-neutral-500">
        Scored 0–100 on demand (30%), expertise fit (30%), openness to competition (20%), and monetisation (20%) —
        see docs/business-methodology.md. Every score is computed here, never taken from the AI's own arithmetic.
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : opportunities.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Nothing yet — complete a few turns in the <a href="/interview" className="underline">Expertise Interview</a>{" "}
          first, then generate opportunities.
        </p>
      ) : (
        <ul className="space-y-4">
          {opportunities.map((o) => (
            <li key={o.id} className="rounded-lg border border-neutral-200 bg-white p-5">
              <div className="mb-2 flex items-start justify-between">
                <h2 className="font-semibold text-neutral-900">{o.title}</h2>
                <span className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white">
                  {o.overallScore}/100
                </span>
              </div>
              <p className="mb-3 text-sm text-neutral-600">
                <strong>{o.audience}</strong> — {o.problem}
              </p>
              <dl className="mb-3 grid grid-cols-2 gap-2 text-xs text-neutral-500">
                <div>Demand: {o.demandScore}/100 — {o.demandEvidence}</div>
                <div>Expertise fit: {o.expertiseFitScore}/100</div>
                <div>Competition: {100 - o.competitionDensity}/100 open — {o.competitionEvidence}</div>
                <div>Monetisation: {o.monetisationScore}/100</div>
              </dl>
              {o.status === "selected" ? (
                <span className="text-xs font-medium text-green-700">Selected</span>
              ) : (
                <button onClick={() => handleSelect(o.id)} className="text-xs font-medium text-neutral-700 underline">
                  Select this one
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
