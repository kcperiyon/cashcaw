// The swap boundary for taking money, same idea as BusinessAIProvider for AI.
// Modelled on Mongozutu's PaymentProvider: charge() starts a payment and hands
// back where to send the buyer; verify() asks the provider (never the browser)
// what actually happened. Fulfilment trusts only verify().

export interface ChargeInput {
  /** Unique per payment attempt; becomes the provider's transaction reference. */
  reference: string;
  amountMinor: number;
  currency: string;
  buyerEmail: string;
  buyerName: string;
  description: string;
  /** Unguessable handle for the buyer's order — carried through the provider round trip. */
  orderToken: string;
  /** Absolute origin of this app, e.g. https://cashcaw.example.com */
  origin: string;
}

export interface ChargeResult {
  /** Where to send the buyer's browser to pay. */
  redirectUrl: string;
  rawJson?: unknown;
}

export interface VerifyInput {
  providerRef: string;
  amountMinor: number;
  currency: string;
  rawJson: unknown;
}

export interface VerifyResult {
  status: "succeeded" | "failed" | "pending";
  /** What the provider says was actually charged — fulfilment compares this to the order. */
  amountMinor: number;
  currency: string;
  rawJson?: unknown;
}

export interface PaymentProvider {
  readonly id: string;
  charge(input: ChargeInput): Promise<ChargeResult>;
  verify(input: VerifyInput): Promise<VerifyResult>;
}
