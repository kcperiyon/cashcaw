"use client";

import { useEffect, useState } from "react";

type AssetType = "lead_magnet" | "email_sequence" | "social_posts" | "webinar_script";
type Asset = { id: string; type: AssetType; title: string; contentJson: unknown; createdAt: string };

const TYPE_LABEL: Record<AssetType, string> = {
  lead_magnet: "Lead magnet",
  email_sequence: "Email sequence",
  social_posts: "Social posts",
  webinar_script: "Webinar script",
};

export function RepurposeSection({ productId }: { productId: string }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<AssetType | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/products/${productId}/repurpose`);
    const body = await res.json();
    setAssets(body.assets);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [productId]);

  async function handleGenerate(targetType: AssetType) {
    setGenerating(targetType);
    setError(null);
    const res = await fetch(`/api/products/${productId}/repurpose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Something went wrong." }));
      setError(body.error ?? "Something went wrong.");
      setGenerating(null);
      return;
    }
    setGenerating(null);
    await load();
  }

  function renderContent(asset: Asset) {
    const c = asset.contentJson as {
      body?: string;
      emails?: { subject: string; body: string }[];
      posts?: { platform: string; content: string }[];
      sections?: { title: string; content: string }[];
    };

    if (asset.type === "lead_magnet") {
      return <p className="whitespace-pre-wrap text-sm text-neutral-600">{c.body}</p>;
    }
    if (asset.type === "email_sequence") {
      return (
        <div className="space-y-4">
          {c.emails?.map((e, i) => (
            <div key={i} className="rounded-md bg-neutral-50 p-3">
              <div className="mb-1 text-sm font-semibold text-neutral-800">
                Email {i + 1}: {e.subject}
              </div>
              <p className="whitespace-pre-wrap text-sm text-neutral-600">{e.body}</p>
            </div>
          ))}
        </div>
      );
    }
    if (asset.type === "social_posts") {
      return (
        <div className="space-y-3">
          {c.posts?.map((p, i) => (
            <div key={i} className="rounded-md bg-neutral-50 p-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{p.platform}</div>
              <p className="whitespace-pre-wrap text-sm text-neutral-600">{p.content}</p>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {c.sections?.map((s, i) => (
          <div key={i}>
            <div className="mb-1 text-sm font-semibold text-neutral-800">{s.title}</div>
            <p className="whitespace-pre-wrap text-sm text-neutral-600">{s.content}</p>
          </div>
        ))}
      </div>
    );
  }

  const types: AssetType[] = ["lead_magnet", "email_sequence", "social_posts", "webinar_script"];

  return (
    <div className="mt-8 border-t border-neutral-200 pt-8">
      <h2 className="mb-2 text-lg font-semibold text-neutral-900">Repurpose</h2>
      <p className="mb-4 text-sm text-neutral-500">
        Turn this product's real content into a downstream asset — grounded in what you actually built, not a
        generic template.
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-6 flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => handleGenerate(t)}
            disabled={generating !== null}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            {generating === t ? "Generating…" : `Generate ${TYPE_LABEL[t].toLowerCase()}`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-neutral-400">Nothing generated yet.</p>
      ) : (
        <ul className="space-y-3">
          {assets.map((asset) => (
            <li key={asset.id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700">
                    {TYPE_LABEL[asset.type]}
                  </span>
                  <span className="ml-2 text-sm font-medium text-neutral-900">{asset.title}</span>
                </div>
                <button
                  onClick={() => setExpanded(expanded === asset.id ? null : asset.id)}
                  className="text-xs text-neutral-500 underline"
                >
                  {expanded === asset.id ? "Collapse" : "Expand"}
                </button>
              </div>
              {expanded === asset.id && <div className="border-t border-neutral-100 pt-3">{renderContent(asset)}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
