import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/origin";
import { settleOrder } from "@/lib/payments/settle";

/**
 * Where the payment provider sends the buyer back. Only the order token is
 * read from the URL; every other parameter (status, tx_ref, a resp=<JSON>
 * blob) is attacker-controllable and ignored. settleOrder() re-verifies with
 * the provider, so hitting this URL by hand can't mark anything paid.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const origin = appOrigin(request);
  if (!token) return NextResponse.redirect(new URL("/", origin));

  try {
    await settleOrder(token);
  } catch (err) {
    console.error("payment callback: settle failed", err);
  }
  return NextResponse.redirect(new URL(`/access/${encodeURIComponent(token)}`, origin));
}
