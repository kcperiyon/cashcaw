"use client";

import { useEffect, useState } from "react";

type Order = {
  id: string;
  buyerName: string;
  buyerEmail: string;
  tierName: string;
  currency: string;
  totalMinor: number;
  status: "pending" | "paid" | "failed" | "refunded";
  createdAt: string;
};

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(minor / 100);
}

export function StorefrontSection({
  productId,
  publicSlug,
  published,
  onChange,
}: {
  productId: string;
  publicSlug: string | null;
  published: boolean;
  onChange: () => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadOrders() {
    const res = await fetch(`/api/products/${productId}/orders`);
    if (res.ok) setOrders((await res.json()).orders);
  }

  useEffect(() => {
    loadOrders();
  }, [productId]);

  async function setPublished(next: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/products/${productId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: next }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Something went wrong." }));
      setError(body.error ?? "Something went wrong.");
    } else {
      onChange();
    }
    setBusy(false);
  }

  const link = publicSlug && typeof window !== "undefined" ? `${window.location.origin}/p/${publicSlug}` : null;
  const paid = orders.filter((o) => o.status === "paid");
  const revenue = paid.reduce<Record<string, number>>((acc, o) => {
    acc[o.currency] = (acc[o.currency] ?? 0) + o.totalMinor;
    return acc;
  }, {});

  return (
    <div className="mt-8 border-t border-neutral-200 pt-8">
      <h2 className="mb-2 text-lg font-semibold text-neutral-900">Storefront</h2>
      <p className="mb-4 text-sm text-neutral-500">
        Publish the sales page you selected above to get a public link buyers can pay on.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-5">
        {published && link ? (
          <>
            <p className="mb-1 text-sm font-medium text-green-700">Live</p>
            <a href={link} target="_blank" rel="noreferrer" className="break-all text-sm text-neutral-900 underline">
              {link}
            </a>
            <div className="mt-4">
              <button
                onClick={() => setPublished(false)}
                disabled={busy}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
              >
                Unpublish
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => setPublished(true)}
            disabled={busy}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {busy ? "Publishing…" : "Publish sales page"}
          </button>
        )}
      </div>

      <h3 className="mb-2 text-sm font-semibold text-neutral-700">
        Orders ({paid.length} paid
        {Object.keys(revenue).length > 0 && ` · ${Object.entries(revenue).map(([c, m]) => money(m, c)).join(", ")}`})
      </h3>
      {orders.length === 0 ? (
        <p className="text-sm text-neutral-400">No orders yet.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm">
              <span>
                <span className="font-medium text-neutral-900">{o.buyerName}</span>{" "}
                <span className="text-neutral-500">{o.buyerEmail} · {o.tierName}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-neutral-900">{money(o.totalMinor, o.currency)}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    o.status === "paid" ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {o.status}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
