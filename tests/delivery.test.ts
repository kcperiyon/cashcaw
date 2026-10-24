import { describe, expect, it } from "vitest";
import { downloadFilename, toMarkdown, type Deliverable } from "../src/lib/delivery";

const base = { productId: "p1", title: "Cold Email Mastery", audience: "freelancers", transformation: "land clients" };

describe("toMarkdown", () => {
  it("renders a course as modules and lessons with exercises", () => {
    const d: Deliverable = {
      ...base,
      format: "course",
      modules: [{ title: "Foundations", lessons: [{ title: "Why it works", content: "Body text.", exercise: "Write one." }] }],
      sections: [],
    };
    const md = toMarkdown(d);
    expect(md).toContain("# Cold Email Mastery");
    expect(md).toContain("## Module 1: Foundations");
    expect(md).toContain("### Why it works");
    expect(md).toContain("**Exercise:** Write one.");
  });

  it("labels ebook sections as chapters and template sections as items", () => {
    const sections = [{ title: "Start", content: "Hello." }];
    expect(toMarkdown({ ...base, format: "ebook", modules: [], sections })).toContain("## Chapter 1: Start");
    expect(toMarkdown({ ...base, format: "template", modules: [], sections })).toContain("## Item 1: Start");
  });
});

describe("downloadFilename", () => {
  it("makes a safe .md filename", () => {
    expect(downloadFilename("Cold Email Mastery!")).toBe("cold-email-mastery.md");
    expect(downloadFilename('"><script>')).toBe("script.md");
    expect(downloadFilename("!!!")).toBe("download.md");
  });
});
