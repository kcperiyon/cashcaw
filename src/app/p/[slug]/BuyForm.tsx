"use client";

import { useState } from "react";

type Tier = { name: string; price: string; description: string; chargeLabel: string | null };

export function BuyForm({ slug, tiers, cta }: { slug: string; tiers: Tier[]; cta: string }) {
  const firstBuyable = tiers.findIndex((t) => t.chargeLabel);
  const [selected, setSelected] = useState(firstBuyable === -1 ? 0 : firstBuyable);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tier = tiers[selected];
  const canBuy = Boolean(tier?.chargeLabel);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/${slug}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierIndex: selected, name, email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.redirectUrl) {
        setError(body.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = body.redirectUrl;
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-5 space-y-2">
        {tiers.map((t, i) => (
          <label
            key={i}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
              selected === i ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"
            } ${t.chargeLabel ? "" : "opacity-50"}`}
          >
            <input
              type="radio"
              name="tier"
              checked={selected === i}
              disabled={!t.chargeLabel}
              onChange={() => setSelected(i)}
              className="mt-1"
            />
            <span className="flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-neutral-900">{t.name}</span>
                <span className="font-semibold text-neutral-900">{t.price}</span>
              </span>
              <span className="block text-sm text-neutral-600">{t.description}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          autoComplete="email"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !canBuy}
        className="w-full rounded-md bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {submitting ? "Taking you to payment…" : canBuy ? `${cta || "Buy now"} — pay ${tier.chargeLabel} once` : "Not available online"}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-500">
        You&apos;ll get a private link to your purchase right after payment. Save it — it&apos;s how you access it.
      </p>
    </form>
  );
}
