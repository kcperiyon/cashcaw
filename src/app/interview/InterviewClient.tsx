"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";

type Message = { id?: string; role: "founder" | "interviewer"; content: string };

const OPENING_QUESTION =
  "What have you spent years learning, or what problems do people repeatedly ask you to solve?";

export function InterviewClient() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factCount, setFactCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/interview")
      .then((res) => res.json())
      .then((body) => setMessages(body.messages));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const founderMessage = draft;
    setDraft("");
    setError(null);
    setSending(true);

    // Optimistic bubble — rolled back on failure so a failed turn doesn't
    // leave the founder's message stuck with no way to retry.
    setMessages((prev) => [...prev, { role: "founder", content: founderMessage }]);

    const res = await fetch("/api/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ founderMessage }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Something went wrong." }));
      setError(body.error ?? "Something went wrong.");
      setMessages((prev) => prev.slice(0, -1));
      setDraft(founderMessage);
      setSending(false);
      return;
    }

    const body = await res.json();
    setMessages((prev) => [...prev, { role: "interviewer", content: body.message }]);
    if (body.extractedFacts.length > 0) {
      setFactCount((c) => c + body.extractedFacts.length);
    }
    setSending(false);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <AppNav />
      <h1 className="mb-2 text-2xl font-semibold text-neutral-900">Expertise Interview</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Answer a few questions about what you know. Once you've shared enough,{" "}
        <a href="/opportunities" className="underline">
          find your opportunities
        </a>
        .
      </p>

      <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-700">{OPENING_QUESTION}</div>
          )}
          {messages.map((m, i) => (
            <div
              key={m.id ?? i}
              className={m.role === "founder" ? "ml-auto max-w-[80%] rounded-md bg-neutral-900 p-3 text-sm text-white" : "max-w-[80%] rounded-md bg-neutral-50 p-3 text-sm text-neutral-700"}
            >
              {m.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={messages.length === 0 ? "Type your answer…" : "Reply…"}
          required
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>

      {factCount > 0 && (
        <p className="mt-4 text-sm text-neutral-500">
          {factCount} expertise fact{factCount === 1 ? "" : "s"} gathered so far.{" "}
          <button onClick={() => router.push("/opportunities")} className="underline">
            Find opportunities now
          </button>
        </p>
      )}
    </main>
  );
}
