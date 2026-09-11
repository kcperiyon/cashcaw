// Client for platform-services' knowledge/RAG service (../platform-services,
// originally pulled from Skynett, now also consumed by Zeroid — Cashcaw is
// the third consumer, exactly the kind of reuse that repo was extracted
// for). Reached through an authenticated nginx path, NOT the raw Docker
// host port: the service has no auth of its own and its host port is bound
// to 127.0.0.1 only on the VPS, so this shared-secret header is the only
// way in from outside.
//
// Cashcaw has no separate "Business" entity below Organization (unlike
// Zeroid) — the org IS the scoping unit, so organizationId is passed
// directly as business_id. It's a cuid, a different format from Skynett's
// UUIDs and Zeroid's own cuids only by coincidence of timing, so there's no
// realistic collision risk and no separate tenant-mapping column is needed.

const BASE_URL = process.env.PLATFORM_KNOWLEDGE_BASE_URL ?? "https://wa.lagosbusinessgroup.com/platform/knowledge";
const API_KEY = process.env.PLATFORM_KNOWLEDGE_API_KEY;

function requireConfig() {
  if (!API_KEY) {
    throw new Error("PLATFORM_KNOWLEDGE_API_KEY is not set — My Expertise is unavailable.");
  }
}

async function call(path: string, init: RequestInit) {
  requireConfig();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Platform-Key": API_KEY!,
      ...init.headers,
    },
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // The knowledge service is unreachable/misconfigured and something in
    // front of it (nginx, Cloudflare) returned HTML instead of JSON.
    throw new Error(`Knowledge service returned a non-JSON response (status ${res.status}).`);
  }

  if (!res.ok) {
    const message = (body as { detail?: string; error?: string } | null)?.detail
      ?? (body as { detail?: string; error?: string } | null)?.error
      ?? `Knowledge service error (status ${res.status}).`;
    throw new Error(message);
  }

  return body;
}

export async function ingestText(params: {
  sourceId: string;
  sourceName: string;
  text: string;
  organizationId: string;
}) {
  await call("/ingest-text", {
    method: "POST",
    body: JSON.stringify({
      source_id: params.sourceId,
      source_name: params.sourceName,
      text: params.text,
      business_id: params.organizationId,
    }),
  });
}

export async function ingestUrl(params: {
  sourceId: string;
  url: string;
  name: string;
  organizationId: string;
}) {
  await call("/ingest-url", {
    method: "POST",
    body: JSON.stringify({
      source_id: params.sourceId,
      url: params.url,
      name: params.name,
      business_id: params.organizationId,
    }),
  });
}

export async function deleteSource(sourceId: string) {
  await call(`/sources/${encodeURIComponent(sourceId)}`, { method: "DELETE" });
}

export type KnowledgeChunk = { content: string; source: string; score: number };

export async function retrieve(params: { query: string; organizationId: string; topK?: number }): Promise<KnowledgeChunk[]> {
  const body = (await call("/retrieve", {
    method: "POST",
    body: JSON.stringify({
      query: params.query,
      business_id: params.organizationId,
      top_k: params.topK ?? 5,
    }),
  })) as { results?: KnowledgeChunk[] };
  return body.results ?? [];
}

export function isKnowledgeServiceConfigured() {
  return Boolean(API_KEY);
}
