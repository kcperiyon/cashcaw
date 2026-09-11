import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { withOrgScope } from "@/lib/tenant-db";
import { getBusinessAIProvider } from "@/lib/ai";

const TurnSchema = z.object({ founderMessage: z.string().min(1).max(4000) });

/** Loads the interview transcript so the chat UI can resume where it left off. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const messages = await withOrgScope(user.organizationId, (tx) =>
    tx.interviewMessage.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "asc" },
    })
  );
  return NextResponse.json({ messages });
}

/**
 * One Expertise Interview turn: persists the founder's message, asks the AI
 * provider for the next interviewer message + any newly extracted facts,
 * persists both the interviewer's reply and the facts (into ExpertiseFact —
 * the actual input to /api/opportunities later), and returns them.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = TurnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { founderMessage } = parsed.data;

  const history = await withOrgScope(user.organizationId, (tx) =>
    tx.interviewMessage.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "asc" },
    })
  );

  let turn;
  try {
    turn = await getBusinessAIProvider().generateInterviewTurn({
      history: history.map((m) => ({ role: m.role, content: m.content })),
      founderMessage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The interviewer is unavailable right now.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await withOrgScope(user.organizationId, async (tx) => {
    await tx.interviewMessage.create({
      data: { organizationId: user.organizationId, role: "founder", content: founderMessage },
    });
    await tx.interviewMessage.create({
      data: { organizationId: user.organizationId, role: "interviewer", content: turn.message },
    });
    for (const fact of turn.extractedFacts) {
      await tx.expertiseFact.create({ data: { organizationId: user.organizationId, content: fact } });
    }
  });

  return NextResponse.json({ message: turn.message, extractedFacts: turn.extractedFacts });
}
