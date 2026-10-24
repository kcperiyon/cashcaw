"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { InlineForm, LinkButton } from "@/components/InlineForm";
import { sendJson } from "@/lib/client-api";
import { OfferSection } from "./OfferSection";
import { RepurposeSection } from "./RepurposeSection";
import { StorefrontSection } from "./StorefrontSection";

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
  publicSlug: string | null;
  publishedAt: string | null;
  modules: Module[];
  sections: ContentSection[];
};

const FORMAT_LABEL: Record<Product["format"], string> = {
  course: "Course",
  ebook: "Ebook",
  template: "Template pack",
};

export function ProductClient({ productId }: { productId: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which thing is open for editing, e.g. "product", "module:<id>", "lesson:<id>", "section:<id>".
  const [editing, setEditing] = useState<string | null>(null);

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

  /** PATCH one item, then reload. Returns an error message for InlineForm, or null on success. */
  async function save(url: string, body: unknown): Promise<string | null> {
    const result = await sendJson(url, "PATCH", body);
    if (!result.ok) return result.error;
    setEditing(null);
    await load();
    return null;
  }

  async function remove(url: string, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setError(null);
    const result = await sendJson(url, "DELETE");
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await load();
  }

  async function deleteProduct() {
    if (!product) return;
    const live = product.publishedAt ? " Its public sales page will stop working." : "";
    if (!window.confirm(`Delete "${product.title}" and everything under it?${live} This can't be undone.`)) return;
    setError(null);
    const result = await sendJson(`/api/products/${productId}`, "DELETE");
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/products");
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

      {editing === "product" ? (
        <div className="mb-6">
          <InlineForm
            fields={[
              { key: "title", label: "Title", value: product.title },
              { key: "audience", label: "Who it's for", value: product.audience, rows: 2 },
              { key: "transformation", label: "The transformation", value: product.transformation, rows: 3 },
            ]}
            onSave={(v) => save(`/api/products/${productId}`, v)}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-neutral-900">{product.title}</h1>
            <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700">
              {FORMAT_LABEL[product.format]}
            </span>
          </div>
          <p className="mb-1 text-sm text-neutral-600">
            <strong>{product.audience}</strong>
          </p>
          <p className="mb-2 text-sm text-neutral-600">{product.transformation}</p>
          <div className="mb-4 flex gap-3">
            <LinkButton onClick={() => setEditing("product")}>Edit details</LinkButton>
            <LinkButton danger onClick={deleteProduct}>
              Delete product
            </LinkButton>
          </div>
          <p className="mb-6 text-xs text-neutral-400">
            Chosen as a {FORMAT_LABEL[product.format].toLowerCase()} because: {product.formatReason}
          </p>
        </>
      )}

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
              {editing === `module:${mod.id}` ? (
                <div className="mb-3">
                  <InlineForm
                    fields={[{ key: "title", label: `Module ${i + 1} title`, value: mod.title }]}
                    onSave={(v) => save(`/api/modules/${mod.id}`, v)}
                    onCancel={() => setEditing(null)}
                  />
                </div>
              ) : (
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-neutral-900">
                    Module {i + 1}: {mod.title}
                  </h2>
                  <div className="flex shrink-0 gap-3">
                    <LinkButton onClick={() => setEditing(`module:${mod.id}`)}>Rename</LinkButton>
                    <LinkButton
                      danger
                      onClick={() => remove(`/api/modules/${mod.id}`, `Delete module "${mod.title}" and all its lessons?`)}
                    >
                      Delete
                    </LinkButton>
                  </div>
                </div>
              )}
              <div className="space-y-4">
                {mod.lessons.map((lesson) =>
                  editing === `lesson:${lesson.id}` ? (
                    <InlineForm
                      key={lesson.id}
                      fields={[
                        { key: "title", label: "Lesson title", value: lesson.title },
                        { key: "content", label: "Lesson content", value: lesson.content, rows: 12 },
                        { key: "exercise", label: "Exercise", value: lesson.exercise, rows: 3 },
                      ]}
                      onSave={(v) => save(`/api/lessons/${lesson.id}`, v)}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <div key={lesson.id}>
                      <div className="mb-1 flex items-start justify-between gap-3">
                        <h3 className="text-sm font-semibold text-neutral-800">{lesson.title}</h3>
                        <div className="flex shrink-0 gap-3">
                          <LinkButton onClick={() => setEditing(`lesson:${lesson.id}`)}>Edit</LinkButton>
                          <LinkButton
                            danger
                            onClick={() => remove(`/api/lessons/${lesson.id}`, `Delete lesson "${lesson.title}"?`)}
                          >
                            Delete
                          </LinkButton>
                        </div>
                      </div>
                      <p className="mb-2 whitespace-pre-wrap text-sm text-neutral-600">{lesson.content}</p>
                      <p className="rounded-md bg-neutral-50 p-2 text-xs text-neutral-500">
                        <strong>Exercise:</strong> {lesson.exercise}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {product.sections.map((section, i) => {
            const label = product.format === "ebook" ? `Chapter ${i + 1}` : `Item ${i + 1}`;
            return (
              <div key={section.id} className="rounded-lg border border-neutral-200 bg-white p-5">
                {editing === `section:${section.id}` ? (
                  <InlineForm
                    fields={[
                      { key: "title", label: `${label} title`, value: section.title },
                      { key: "content", label: "Content", value: section.content, rows: 14 },
                    ]}
                    onSave={(v) => save(`/api/sections/${section.id}`, v)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h2 className="font-semibold text-neutral-900">
                        {label}: {section.title}
                      </h2>
                      <div className="flex shrink-0 gap-3">
                        <LinkButton onClick={() => setEditing(`section:${section.id}`)}>Edit</LinkButton>
                        <LinkButton
                          danger
                          onClick={() => remove(`/api/sections/${section.id}`, `Delete "${section.title}"?`)}
                        >
                          Delete
                        </LinkButton>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-neutral-600">{section.content}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {product.status === "generated" && (
        <>
          <RepurposeSection productId={product.id} />
          <OfferSection productId={product.id} />
          <StorefrontSection
            productId={product.id}
            publicSlug={product.publicSlug}
            published={product.publishedAt !== null}
            onChange={load}
          />
        </>
      )}
    </main>
  );
}
