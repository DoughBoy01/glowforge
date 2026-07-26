import Stripe from "stripe";

let _stripe: Stripe | undefined;

/** Singleton Stripe client. Uses the fetch-based HTTP client — the default
 * Node client shells out to `http`/`https`, which isn't available in the
 * Workers runtime even with `nodejs_compat`. */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set");

  _stripe = new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia",
    httpClient: Stripe.createFetchHttpClient(),
  });
  return _stripe;
}
