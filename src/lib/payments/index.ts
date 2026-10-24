import type { PaymentProvider } from "./provider";
import { mockProvider } from "./mock";
import { flutterwaveProvider } from "./flutterwave";

/**
 * PAYMENT_PROVIDER picks the adapter. Defaults to the mock outside production
 * and flutterwave inside it. The mock can never be selected in production —
 * its "complete" endpoint would let anyone mark an order paid.
 */
export function getPaymentProvider(): PaymentProvider {
  const production = process.env.NODE_ENV === "production";
  const choice = process.env.PAYMENT_PROVIDER ?? (production ? "flutterwave" : "mock");
  if (choice === "mock") {
    if (production) throw new Error("The mock payment provider is disabled in production.");
    return mockProvider;
  }
  if (choice === "flutterwave") return flutterwaveProvider;
  throw new Error(`Unknown PAYMENT_PROVIDER "${choice}".`);
}

export type { PaymentProvider } from "./provider";
