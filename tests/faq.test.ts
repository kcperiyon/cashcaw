import { describe, expect, it } from "vitest";
import { formatFaq, parseFaq } from "../src/lib/client-api";

describe("faq text round trip", () => {
  const faq = [
    { question: "Is it for me?", answer: "If you freelance, yes.\nEven part time." },
    { question: "Refunds?", answer: "30 days." },
  ];

  it("survives format -> parse, including multi-line answers", () => {
    expect(parseFaq(formatFaq(faq))).toEqual(faq);
  });

  it("drops blocks missing a question or an answer", () => {
    expect(parseFaq("Only a question\n\nQ2?\nA2")).toEqual([{ question: "Q2?", answer: "A2" }]);
    expect(parseFaq("   \n\n  ")).toEqual([]);
  });
});
