"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function MockCheckout() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(outcome: "success" | "fail") {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/payments/mock/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, outcome }),
    });
    if (!res.ok) {
      setError("The mock provider is not available.");
      setBusy(false);
      return;
    }
    router.push(`/access/${encodeURIComponent(token)}`);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="mb-2 inline-block rounded bg-amber-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
        Test payment — no money moves
      </p>
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">Mock payment provider</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => finish("success")}
          disabled={busy || !token}
          className="rounded-md bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Simulate successful payment
        </button>
        <button
          onClick={() => finish("fail")}
          disabled={busy || !token}
          className="rounded-md border border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-700 disabled:opacity-50"
        >
          Simulate failed payment
        </button>
      </div>
    </main>
  );
}

export default function MockCheckoutPage() {
  return (
    <Suspense>
      <MockCheckout />
    </Suspense>
  );
}
