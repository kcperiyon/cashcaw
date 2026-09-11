"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AppNav } from "@/components/AppNav";

type KnowledgeSource = { id: string; name: string; kind: string; createdAt: string };
type KnowledgeChunk = { content: string; source: string; score: number };

export function KnowledgeClient() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeChunk[] | null>(null);
  const [querying, setQuerying] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  async function loadSources() {
    const res = await fetch("/api/knowledge");
    if (res.ok) {
      const body = await res.json();
      setSources(body.sources);
    }
  }

  useEffect(() => {
    loadSources();
  }, []);

  async function handleIngest(event: FormEvent) {
    event.preventDefault();
    setIngesting(true);
    setIngestError(null);

    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, text }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Something went wrong." }));
      setIngestError(body.error ?? "Something went wrong.");
      setIngesting(false);
      return;
    }

    setName("");
    setText("");
    setIngesting(false);
    await loadSources();
  }

  async function handleQuery(event: FormEvent) {
    event.preventDefault();
    setQuerying(true);
    setQueryError(null);
    setResults(null);

    const res = await fetch("/api/knowledge/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Something went wrong." }));
      setQueryError(body.error ?? "Something went wrong.");
      setQuerying(false);
      return;
    }

    const body = await res.json();
    setResults(body.results);
    setQuerying(false);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <AppNav />
      <h1 className="mb-2 text-2xl font-semibold text-neutral-900">My Expertise</h1>
      <p className="mb-8 text-sm text-neutral-500">
        Drop in a note about what you know. It goes into your own knowledge base — later phases will interview you
        properly and turn this into scored business opportunities.
      </p>

      <section className="mb-10 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-neutral-700">Add a note</h2>
        <form onSubmit={handleIngest} className="space-y-3">
          <input
            placeholder="Short title, e.g. 'How I structure a discovery call'"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
          <textarea
            placeholder="Write what you know…"
            required
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
          {ingestError && <p className="text-sm text-red-600">{ingestError}</p>}
          <button
            type="submit"
            disabled={ingesting}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {ingesting ? "Saving…" : "Save to My Expertise"}
          </button>
        </form>
      </section>

      <section className="mb-10 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-neutral-700">Your sources ({sources.length})</h2>
        {sources.length === 0 ? (
          <p className="text-sm text-neutral-400">Nothing yet.</p>
        ) : (
          <ul className="space-y-2">
            {sources.map((s) => (
              <li key={s.id} className="text-sm text-neutral-700">
                {s.name} <span className="text-neutral-400">— {s.kind}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-neutral-700">Ask your knowledge base</h2>
        <form onSubmit={handleQuery} className="mb-4 flex gap-2">
          <input
            placeholder="Ask something you just wrote about…"
            required
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={querying}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            {querying ? "Asking…" : "Ask"}
          </button>
        </form>
        {queryError && <p className="text-sm text-red-600">{queryError}</p>}
        {results && (
          results.length === 0 ? (
            <p className="text-sm text-neutral-400">No matches.</p>
          ) : (
            <ul className="space-y-3">
              {results.map((r, i) => (
                <li key={i} className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-700">
                  {r.content}
                  <div className="mt-1 text-xs text-neutral-400">{r.source}</div>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </main>
  );
}
