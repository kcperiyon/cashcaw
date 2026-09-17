import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getWalletBalance } from "@/lib/ai/metering";

/** The org's current credit balance — shown in the nav so a low/zero balance is never a surprise. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const balance = await getWalletBalance(user.organizationId);
  return NextResponse.json({ balance });
}
