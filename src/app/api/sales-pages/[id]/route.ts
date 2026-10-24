import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { parseBody, requireEditor } from "@/lib/auth/require-editor";
import { withOrgScope } from "@/lib/tenant-db";

const PatchSchema = z.object({
  headline: z.string().trim().min(1).max(300),
  subheadline: z.string().trim().min(1).max(500),
  copy: z.object({
    problemAgitation: z.string().trim().min(1).max(6000),
    mechanismExplainer: z.string().trim().min(1).max(6000),
    whatsIncluded: z.string().trim().min(1).max(6000),
    bonusesText: z.string().trim().max(3000),
    guaranteeText: z.string().trim().min(1).max(2000),
    faq: z.array(z.object({ question: z.string().trim().min(1).max(300), answer: z.string().trim().min(1).max(2000) })).max(20),
    cta: z.string().trim().min(1).max(80),
  }),
});

/** Edits a sales-page variant's copy. If it's the live one, the public page changes immediately. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await params;

  const body = await parseBody(request, PatchSchema);
  if ("response" in body) return body.response;

  const found = await withOrgScope(user.organizationId, async (tx) => {
    const page = await tx.salesPage.findFirst({ where: { id, offer: { organizationId: user.organizationId } } });
    if (!page) return false;
    await tx.salesPage.update({
      where: { id },
      data: {
        headline: body.data.headline,
        subheadline: body.data.subheadline,
        copyJson: body.data.copy as unknown as Prisma.InputJsonValue,
      },
    });
    return true;
  });
  if (!found) return NextResponse.json({ error: "Sales page not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** Deletes an unused variant. The one in use can't be deleted — choose another first. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await params;

  const result = await withOrgScope(user.organizationId, async (tx) => {
    const page = await tx.salesPage.findFirst({ where: { id, offer: { organizationId: user.organizationId } } });
    if (!page) return "not_found" as const;
    if (page.selected) return "in_use" as const;
    await tx.salesPage.delete({ where: { id } });
    return "deleted" as const;
  });

  if (result === "not_found") return NextResponse.json({ error: "Sales page not found." }, { status: 404 });
  if (result === "in_use") {
    return NextResponse.json({ error: "That's the page in use. Choose a different one first." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
