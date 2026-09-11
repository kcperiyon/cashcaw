"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";

type Lesson = { id: string; title: string; content: string; exercise: string };
type Module = { id: string; title: string; lessons: Lesson[] };
type ContentSection = { id: string; kind: "chapter" | "template_item"; title: string; content: string };
type Product = {
  id: string;
  title: string;
  format: "course" | "ebook" | "template";
  formatReason: string;
  status: "draft" | "generated";
  audience: string;
  transformation: string;
  outlineJson: string[];
  modules: Module[];
  sections: ContentSection[];
};

const FORMAT_LABEL: Record<Product["format"], string> = {
  course: "Course",
  ebook: "Ebook",
  template: "Template pack",
};

export function ProductClient({ productId }: { productId: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/products/${productId}`);
    const body = await res.json();
    setProduct(body.product);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [productId]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const res = await fetch(`/api/products/${productId}/generate-content`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Something went wrong." }));
      setError(body.error ?? "Something went wrong.");
      setGenerating(false);
      return;
    }
    setGenerating(false);
    await load();
  }

  if (loading || !product) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <AppNav />
        <p className="text-sm text-neutral-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <AppNav />
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">{product.title}</h1>
        <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700">
          {FORMAT_LABEL[product.format]}
        </span>
      </div>
      <p className="mb-1 text-sm text-neutral-600">
        <strong>{product.audience}</strong>
      </p>
      <p className="mb-4 text-sm text-neutral-600">{product.transformation}</p>
      <p className="mb-6 text-xs text-neutral-400">Chosen as a {FORMAT_LABEL[product.format].toLowerCase()} because: {product.formatReason}</p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {product.status === "draft" ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">Outline</h2>
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-neutral-700">
            {product.outlineJson.map((title, i) => (
              <li key={i}>{title}</li>
            ))}
          </ol>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {generating ? "Writing content… (this can take a minute)" : "Generate full content"}
          </button>
        </div>
      ) : product.format === "course" ? (
        <div className="space-y-6">
          {product.modules.map((mod, i) => (
            <div key={mod.id} className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="mb-3 font-semibold text-neutral-900">
                Module {i + 1}: {mod.title}
              </h2>
              <div className="space-y-4">
                {mod.lessons.map((lesson) => (
                  <div key={lesson.id}>
                    <h3 className="mb-1 text-sm font-semibold text-neutral-800">{lesson.title}</h3>
                    <p className="mb-2 whitespace-pre-wrap text-sm text-neutral-600">{lesson.content}</p>
                    <p className="rounded-md bg-neutral-50 p-2 text-xs text-neutral-500">
                      <strong>Exercise:</strong> {lesson.exercise}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {product.sections.map((section, i) => (
            <div key={section.id} className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="mb-2 font-semibold text-neutral-900">
                {product.format === "ebook" ? `Chapter ${i + 1}` : `Item ${i + 1}`}: {section.title}
              </h2>
              <p className="whitespace-pre-wrap text-sm text-neutral-600">{section.content}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
