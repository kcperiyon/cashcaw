// Best-effort fixed-window limiter for public (unauthenticated) endpoints.
// In-memory, so it is per server process: it blunts casual order/probe spam
// on the single PM2 instance but is not a distributed guarantee.

const hits = new Map<string, { count: number; windowStart: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    hits.set(key, { count: 1, windowStart: now });
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now - v.windowStart >= windowMs) hits.delete(k);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
