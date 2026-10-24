// Tiny fetch wrapper for the editor UIs: returns the server's error message
// instead of throwing, so callers can show it inline.

export async function sendJson(
  url: string,
  method: "PATCH" | "DELETE" | "POST",
  body?: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => null);
    return { ok: false, error: data?.error ?? "Something went wrong." };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

/** Parses "Question?\nAnswer lines\n\nNext question?\nAnswer" blocks into FAQ items; the reverse is formatFaq. */
export function parseFaq(text: string): { question: string; answer: string }[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [question, ...rest] = block.split("\n");
      return { question: question.trim(), answer: rest.join("\n").trim() };
    })
    .filter((item) => item.question && item.answer);
}

export function formatFaq(faq: { question: string; answer: string }[]): string {
  return faq.map((f) => `${f.question}\n${f.answer}`).join("\n\n");
}
