"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";

type Product = {
  id: string;
  title: string;
  format: "course" | "ebook" | "template";
  status: "draft" | "generated";
  audience: string;
};

const FORMAT_LABEL: Record<Product["format"], string> = {
  course: "Course",
  ebook: "Ebook",
  template: "Template pack",
};

export function ProductsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((body) => {
        setProducts(body.products);
        setLoading(false);
      });
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <AppNav />
      <h1 className="mb-2 text-2xl font-semibold text-neutral-900">Products</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Built from your <a href="/opportunities" className="underline">Opportunities</a> — the same content engine
        renders each one differently depending on its format.
      </p>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Nothing yet — pick an opportunity and click "Build this" to create your first product.
        </p>
      ) : (
        <ul className="space-y-3">
          {products.map((p) => (
            <li key={p.id}>
              <Link
                href={`/products/${p.id}`}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-300"
              >
                <div>
                  <div className="font-medium text-neutral-900">{p.title}</div>
                  <div className="text-xs text-neutral-500">{p.audience}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700">
                    {FORMAT_LABEL[p.format]}
                  </span>
                  <span className={p.status === "generated" ? "text-xs font-medium text-green-700" : "text-xs text-neutral-400"}>
                    {p.status === "generated" ? "Generated" : "Draft"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
