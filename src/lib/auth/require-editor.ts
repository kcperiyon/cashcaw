import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Guard for mutating routes: signed in AND not a read-only viewer. Returns
 * either the user or a ready-made error response — callers do
 *   const auth = await requireEditor(); if ("response" in auth) return auth.response;
 */
export async function requireEditor(): Promise<{ user: CurrentUser } | { response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  if (user.role === "viewer") {
    return { response: NextResponse.json({ error: "Viewers can't make changes." }, { status: 403 }) };
  }
  return { user };
}

/** Parses a JSON body against a zod schema; returns the data or a 400 response. */
export async function parseBody<T>(
  request: Request,
  schema: {
    safeParse(
      input: unknown
    ): { success: true; data: T } | { success: false; error: { issues: { message: string; path: PropertyKey[] }[] } };
  }
): Promise<{ data: T } | { response: NextResponse }> {
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    const issue = result.error.issues[0];
    // zod's own wording ("Too small: expected string to have >=1 characters") means nothing to a creator.
    const field = issue?.path.map(String).join(" › ");
    const message = field ? `Please check the "${field}" field — it's empty, too long, or invalid.` : "Invalid input.";
    return { response: NextResponse.json({ error: message }, { status: 400 }) };
  }
  return { data: result.data };
}
