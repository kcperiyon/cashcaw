/**
 * Absolute origin used in links sent to a payment provider and in redirects.
 * APP_URL wins (set it in production behind nginx, where the request URL may
 * be the internal one); otherwise the request's own origin.
 */
export function appOrigin(request: Request): string {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  return configured || new URL(request.url).origin;
}
