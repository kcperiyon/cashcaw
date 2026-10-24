import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export interface Deliverable {
  productId: string;
  title: string;
  format: "course" | "ebook" | "template";
  audience: string;
  transformation: string;
  modules: { title: string; lessons: { title: string; content: string; exercise: string }[] }[];
  sections: { title: string; content: string }[];
}

/** The finished content of one product, in reading order. Caller must already be org-scoped. */
export async function loadDeliverable(tx: Tx, organizationId: string, productId: string): Promise<Deliverable | null> {
  const product = await tx.product.findFirst({
    where: { id: productId, organizationId },
    include: {
      modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } },
      sections: { orderBy: { order: "asc" } },
    },
  });
  if (!product) return null;
  return {
    productId: product.id,
    title: product.title,
    format: product.format,
    audience: product.audience,
    transformation: product.transformation,
    modules: product.modules.map((m) => ({
      title: m.title,
      lessons: m.lessons.map((l) => ({ title: l.title, content: l.content, exercise: l.exercise })),
    })),
    sections: product.sections.map((s) => ({ title: s.title, content: s.content })),
  };
}

/** Renders a deliverable as a single Markdown document the buyer can download and keep. */
export function toMarkdown(d: Deliverable): string {
  const out: string[] = [`# ${d.title}`, "", `*For ${d.audience}*`, "", d.transformation, ""];

  if (d.format === "course") {
    d.modules.forEach((mod, i) => {
      out.push(`## Module ${i + 1}: ${mod.title}`, "");
      for (const lesson of mod.lessons) {
        out.push(`### ${lesson.title}`, "", lesson.content, "", `**Exercise:** ${lesson.exercise}`, "");
      }
    });
  } else {
    const label = d.format === "ebook" ? "Chapter" : "Item";
    d.sections.forEach((s, i) => {
      out.push(`## ${label} ${i + 1}: ${s.title}`, "", s.content, "");
    });
  }
  return out.join("\n");
}

export function downloadFilename(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "download"}.md`;
}
