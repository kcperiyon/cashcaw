"use client";

import { useEffect, useState } from "react";
import { InlineForm, LinkButton } from "@/components/InlineForm";
import { formatFaq, parseFaq, sendJson } from "@/lib/client-api";

type PriceTier = { name: string; price: string; description: string };
type SalesPageCopy = {
  problemAgitation: string;
  mechanismExplainer: string;
  whatsIncluded: string;
  bonusesText: string;
  guaranteeText: string;
  faq: { question: string; answer: string }[];
  cta: string;
};
type SalesPage = {
  id: string;
  positioning: "outcome" | "pain" | "identity";
  headline: string;
  subheadline: string;
  copyJson: SalesPageCopy;
  clarityScore: number;
  rationale: string;
  selected: boolean;
};
type Offer = {
  id: string;
  promise: string;
  mechanism: string;
  bonusesJson: string[];
  guaranteeText: string;
  priceTiersJson: PriceTier[];
  salesPages: SalesPage[];
};

const POSITIONING_LABEL: Record<SalesPage["positioning"], string> = {
  outcome: "Outcome-driven",
  pain: "Pain-driven",
  identity: "Identity-driven",
};

export function OfferSection({ productId }: { productId: string }) {
  const [offer, setOffer] = useState<Offer | null | undefined>(undefined);
  const [buildingOffer, setBuildingOffer] = useState(false);
  const [generatingPages, setGeneratingPages] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  async function saveJson(url: string, body: unknown): Promise<string | null> {
    const result = await sendJson(url, "PATCH", body);
    if (!result.ok) return result.error;
    setEditing(null);
    await load();
    return null;
  }

  async function load() {
    const res = await fetch(`/api/products/${productId}/offer`);
    const body = await res.json();
    setOffer(body.offer);
  }

  useEffect(() => {
    load();
  }, [productId]);

  async function handleBuildOffer() {
    setBuildingOffer(true);
    setError(null);
    const res = await fetch(`/api/products/${productId}/offer`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Something went wrong." }));
      setError(body.error ?? "Something went wrong.");
      setBuildingOffer(false);
      return;
    }
    setBuildingOffer(false);
    await load();
  }

  async function handleGeneratePages() {
    if (!offer) return;
    setGeneratingPages(true);
    setError(null);
    const res = await fetch(`/api/offers/${offer.id}/sales-pages`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Something went wrong." }));
      setError(body.error ?? "Something went wrong.");
      setGeneratingPages(false);
      return;
    }
    setGeneratingPages(false);
    await load();
  }

  async function handleSelect(pageId: string) {
    await fetch(`/api/sales-pages/${pageId}/select`, { method: "POST" });
    await load();
  }

  if (offer === undefined) return null;

  return (
    <div className="mt-8 border-t border-neutral-200 pt-8">
      <h2 className="mb-4 text-lg font-semibold text-neutral-900">Offer &amp; Sales Page</h2>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!offer ? (
        <button
          onClick={handleBuildOffer}
          disabled={buildingOffer}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {buildingOffer ? "Building offer…" : "Build offer"}
        </button>
      ) : (
        <>
          {editing === "offer" ? (
            <div className="mb-6">
              <InlineForm
                fields={[
                  { key: "promise", label: "Promise", value: offer.promise, rows: 2 },
                  { key: "mechanism", label: "Mechanism", value: offer.mechanism, rows: 3 },
                  { key: "bonuses", label: "Bonuses (one per line)", value: offer.bonusesJson.join("\n"), rows: 4 },
                  { key: "guaranteeText", label: "Guarantee", value: offer.guaranteeText, rows: 2 },
                  ...offer.priceTiersJson.flatMap((t, i) => [
                    { key: `t${i}name`, label: `Tier ${i + 1} name`, value: t.name },
                    { key: `t${i}price`, label: `Tier ${i + 1} price (e.g. $97 or ₦15,000)`, value: t.price },
                    { key: `t${i}desc`, label: `Tier ${i + 1} description`, value: t.description },
                  ]),
                ]}
                onSave={(v) =>
                  saveJson(`/api/offers/${offer.id}`, {
                    promise: v.promise,
                    mechanism: v.mechanism,
                    guaranteeText: v.guaranteeText,
                    bonuses: v.bonuses.split("\n").map((b) => b.trim()).filter(Boolean),
                    priceTiers: offer.priceTiersJson.map((_, i) => ({
                      name: v[`t${i}name`],
                      price: v[`t${i}price`],
                      description: v[`t${i}desc`],
                    })),
                  })
                }
                onCancel={() => setEditing(null)}
              />
            </div>
          ) : (
          <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-5">
            <div className="mb-2 flex justify-end gap-3">
              <LinkButton onClick={() => setEditing("offer")}>Edit offer</LinkButton>
            </div>
            <p className="mb-2 text-sm text-neutral-800">
              <strong>Promise:</strong> {offer.promise}
            </p>
            <p className="mb-3 text-sm text-neutral-600">
              <strong>Mechanism:</strong> {offer.mechanism}
            </p>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Bonuses</p>
            <ul className="mb-3 list-disc pl-5 text-sm text-neutral-600">
              {offer.bonusesJson.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            <p className="mb-3 text-sm text-neutral-600">
              <strong>Guarantee:</strong> {offer.guaranteeText}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {offer.priceTiersJson.map((tier, i) => (
                <div key={i} className="rounded-md bg-neutral-50 p-3 text-center">
                  <div className="text-xs font-semibold text-neutral-700">{tier.name}</div>
                  <div className="text-lg font-semibold text-neutral-900">{tier.price}</div>
                  <div className="mt-1 text-xs text-neutral-500">{tier.description}</div>
                </div>
              ))}
            </div>
          </div>
          )}

          {offer.salesPages.length === 0 ? (
            <button
              onClick={handleGeneratePages}
              disabled={generatingPages}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {generatingPages ? "Writing sales pages…" : "Generate sales pages"}
            </button>
          ) : (
            <div className="space-y-4">
              {offer.salesPages.map((page) => editing === `page:${page.id}` ? (
                <InlineForm
                  key={page.id}
                  fields={[
                    { key: "headline", label: "Headline", value: page.headline },
                    { key: "subheadline", label: "Subheadline", value: page.subheadline, rows: 2 },
                    { key: "problemAgitation", label: "Problem", value: page.copyJson.problemAgitation, rows: 4 },
                    { key: "mechanismExplainer", label: "Why it works", value: page.copyJson.mechanismExplainer, rows: 4 },
                    { key: "whatsIncluded", label: "What's included", value: page.copyJson.whatsIncluded, rows: 4 },
                    { key: "bonusesText", label: "Bonuses text", value: page.copyJson.bonusesText, rows: 3 },
                    { key: "guaranteeText", label: "Guarantee", value: page.copyJson.guaranteeText, rows: 3 },
                    {
                      key: "faq",
                      label: "FAQ (question on the first line, answer below; blank line between items)",
                      value: formatFaq(page.copyJson.faq),
                      rows: 8,
                    },
                    { key: "cta", label: "Button text", value: page.copyJson.cta },
                  ]}
                  onSave={(v) =>
                    saveJson(`/api/sales-pages/${page.id}`, {
                      headline: v.headline,
                      subheadline: v.subheadline,
                      copy: {
                        problemAgitation: v.problemAgitation,
                        mechanismExplainer: v.mechanismExplainer,
                        whatsIncluded: v.whatsIncluded,
                        bonusesText: v.bonusesText,
                        guaranteeText: v.guaranteeText,
                        faq: parseFaq(v.faq),
                        cta: v.cta,
                      },
                    })
                  }
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div key={page.id} className="rounded-lg border border-neutral-200 bg-white p-5">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700">
                        {POSITIONING_LABEL[page.positioning]}
                      </span>
                      <span className="ml-2 text-xs text-neutral-400">
                        Clarity (AI's own read): {page.clarityScore}/100
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {page.selected ? (
                        <span className="text-xs font-medium text-green-700">In use</span>
                      ) : (
                        <button onClick={() => handleSelect(page.id)} className="text-xs font-medium text-neutral-700 underline">
                          Use this one
                        </button>
                      )}
                      <LinkButton onClick={() => setEditing(`page:${page.id}`)}>Edit</LinkButton>
                      {!page.selected && (
                        <LinkButton
                          danger
                          onClick={async () => {
                            if (!window.confirm("Delete this sales page variant?")) return;
                            const r = await sendJson(`/api/sales-pages/${page.id}`, "DELETE");
                            if (!r.ok) setError(r.error);
                            else await load();
                          }}
                        >
                          Delete
                        </LinkButton>
                      )}
                    </div>
                  </div>
                  <h3 className="mb-1 text-lg font-semibold text-neutral-900">{page.headline}</h3>
                  <p className="mb-2 text-sm text-neutral-600">{page.subheadline}</p>
                  <p className="mb-3 text-xs italic text-neutral-400">{page.rationale}</p>

                  {expanded === page.id ? (
                    <div className="space-y-3 border-t border-neutral-100 pt-3 text-sm text-neutral-600">
                      <p>{page.copyJson.problemAgitation}</p>
                      <p>{page.copyJson.mechanismExplainer}</p>
                      <p><strong>What's included:</strong> {page.copyJson.whatsIncluded}</p>
                      <p><strong>Bonuses:</strong> {page.copyJson.bonusesText}</p>
                      <p><strong>Guarantee:</strong> {page.copyJson.guaranteeText}</p>
                      <div>
                        <strong>FAQ</strong>
                        <ul className="mt-1 space-y-2">
                          {page.copyJson.faq.map((f, i) => (
                            <li key={i}>
                              <div className="font-medium text-neutral-700">{f.question}</div>
                              <div>{f.answer}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className="rounded-md bg-neutral-900 px-3 py-2 text-center text-sm font-medium text-white">
                        {page.copyJson.cta}
                      </p>
                      <button onClick={() => setExpanded(null)} className="text-xs text-neutral-400 underline">
                        Collapse
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setExpanded(page.id)} className="text-xs text-neutral-500 underline">
                      Read full page
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
