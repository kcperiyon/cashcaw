// Offer price tiers are stored as the free-text string the AI wrote ("$97",
// "₦15,000", "USD 49.50"). Orders need exact integer minor units, so the
// string is parsed here — and a tier whose price can't be parsed is simply
// not purchasable rather than guessed at.

const SYMBOL_CURRENCY: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "₦": "NGN",
};

const SUPPORTED = new Set(["USD", "EUR", "GBP", "NGN"]);

// Upper bound on a single order: 100 million major units.
const MAX_MINOR = 100_000_000 * 100;

export interface ParsedPrice {
  currency: string;
  amountMinor: number;
}

export function parsePrice(input: string): ParsedPrice | null {
  const text = input.trim();
  if (!text) return null;

  let currency: string | null = null;
  const symbol = Object.keys(SYMBOL_CURRENCY).find((s) => text.includes(s));
  if (symbol) currency = SYMBOL_CURRENCY[symbol];
  const code = text.match(/\b([A-Za-z]{3})\b/)?.[1]?.toUpperCase();
  if (code && SUPPORTED.has(code)) currency = code;
  if (!currency) return null;

  // First number in the string, allowing thousands separators and decimals.
  const match = text.match(/\d[\d,]*(?:\.\d{1,2})?/);
  if (!match) return null;
  const amount = Number(match[0].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const amountMinor = Math.round(amount * 100);
  if (amountMinor > MAX_MINOR) return null;
  return { currency, amountMinor };
}

export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);
}
