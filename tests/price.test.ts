import { describe, expect, it } from "vitest";
import { formatMoney, parsePrice } from "../src/lib/payments/price";

describe("parsePrice", () => {
  it("reads symbol prices into integer minor units", () => {
    expect(parsePrice("$97")).toEqual({ currency: "USD", amountMinor: 9700 });
    expect(parsePrice("₦15,000")).toEqual({ currency: "NGN", amountMinor: 1_500_000 });
    expect(parsePrice("£49.50")).toEqual({ currency: "GBP", amountMinor: 4950 });
    expect(parsePrice("€1,299.99")).toEqual({ currency: "EUR", amountMinor: 129_999 });
  });

  it("reads currency codes, which win over a symbol", () => {
    expect(parsePrice("USD 49")).toEqual({ currency: "USD", amountMinor: 4900 });
    expect(parsePrice("NGN 5,000")).toEqual({ currency: "NGN", amountMinor: 500_000 });
  });

  it("avoids float drift", () => {
    expect(parsePrice("$19.99")?.amountMinor).toBe(1999);
    expect(parsePrice("$0.07")?.amountMinor).toBe(7);
  });

  it("refuses anything it can't price exactly", () => {
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("Free")).toBeNull();
    expect(parsePrice("97")).toBeNull(); // no currency
    expect(parsePrice("$0")).toBeNull();
    expect(parsePrice("Contact us")).toBeNull();
    expect(parsePrice("XYZ 50")).toBeNull(); // unsupported code
    expect(parsePrice("$99999999999")).toBeNull(); // absurd amount
  });
});

describe("formatMoney", () => {
  it("drops cents only when they are zero", () => {
    expect(formatMoney(9700, "USD")).toBe("$97");
    expect(formatMoney(4950, "USD")).toBe("$49.50");
  });
});
