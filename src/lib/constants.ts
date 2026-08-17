export const APP_NAME = "SUHOJA";
export const APP_TAGLINE = "Train your skin like you train your body.";
export const APP_DESCRIPTION =
  "SUHOJA is a skin performance tracker for men 35+. Measure sun damage, firmness, eye area, and moisture over time, follow a routine, and track real progress — not guesswork.";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    features: [
      "Unlimited manual check-ins",
      "Core trend charts (30-day window)",
      "Routine tracking + streaks",
      "1 public share card",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 12,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "",
    features: [
      "Everything in Free",
      "Full history + year-over-year trends",
      "AI-assisted scan analysis",
      "Unlimited share cards + progress comparisons",
      "Priority routine recommendations",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;
