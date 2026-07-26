import type { TrackedMetric } from "@/lib/metrics";

export type PriceTier = "budget" | "premium";

export interface Product {
  id: string;
  brand: string;
  name: string;
  category: string; // display label, e.g. "Sunscreen" — not tied to the routineSteps DB enum
  tier: PriceTier;
  price: string;
  why: string;
  /**
   * Amazon search-results URL (not a specific /dp/ASIN link, which would go
   * stale or point at the wrong variant) tagged with a placeholder
   * associates id. Swap `glowforge-20` for a real tracking tag — and/or
   * per-product direct links from an actual affiliate program — before
   * relying on this for revenue.
   */
  affiliateUrl: string;
}

const amazonSearch = (query: string) =>
  `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=glowforge-20`;

/**
 * Curated, hand-picked per concern — same "managed by hand for v1" approach
 * as `partnerLinks` in the schema. One budget + one premium pick per
 * concern so the protocol can recommend without assuming a budget. Product
 * choices lean toward men's grooming brands and OTC actives (retinoids,
 * vitamin C, caffeine) with real clinical backing rather than trend
 * ingredients, matching the app's "training log, not beauty routine" tone.
 */
export const PRODUCTS: Record<TrackedMetric | "radiance", Product[]> = {
  sun_damage: [
    {
      id: "cerave-am-spf30",
      brand: "CeraVe",
      name: "AM Facial Moisturizing Lotion SPF 30",
      category: "Sunscreen",
      tier: "budget",
      price: "~$17",
      why: "Broad-spectrum SPF that doubles as your morning moisturizer — one fewer step to skip.",
      affiliateUrl: amazonSearch("CeraVe AM Facial Moisturizing Lotion SPF 30"),
    },
    {
      id: "eltamd-uv-clear",
      brand: "EltaMD",
      name: "UV Clear Facial Sunscreen SPF 46",
      category: "Sunscreen",
      tier: "premium",
      price: "~$40",
      why: "The pick dermatologists recommend most — lightweight, no white cast, niacinamide included.",
      affiliateUrl: amazonSearch("EltaMD UV Clear Facial Sunscreen SPF 46"),
    },
  ],
  firmness: [
    {
      id: "ordinary-granactive-retinoid",
      brand: "The Ordinary",
      name: "Granactive Retinoid 2% Emulsion",
      category: "Retinoid",
      tier: "budget",
      price: "~$10",
      why: "A milder retinoid ester — good starting point if you've never used one before.",
      affiliateUrl: amazonSearch("The Ordinary Granactive Retinoid 2% Emulsion"),
    },
    {
      id: "skinceuticals-retinol-03",
      brand: "SkinCeuticals",
      name: "Retinol 0.3",
      category: "Retinoid",
      tier: "premium",
      price: "~$78",
      why: "Clinical-strength retinol formulated to minimize the irritation that makes most guys quit early.",
      affiliateUrl: amazonSearch("SkinCeuticals Retinol 0.3"),
    },
  ],
  eye_area: [
    {
      id: "ordinary-caffeine-solution",
      brand: "The Ordinary",
      name: "Caffeine Solution 5% + EGCG",
      category: "Eye treatment",
      tier: "budget",
      price: "~$8",
      why: "Caffeine constricts blood vessels near the surface — the most direct fix for under-eye puffiness.",
      affiliateUrl: amazonSearch("The Ordinary Caffeine Solution 5% EGCG"),
    },
    {
      id: "kiehls-eye-concentrate",
      brand: "Kiehl's",
      name: "Powerful-Strength Line-Reducing Eye-Brightening Concentrate",
      category: "Eye treatment",
      tier: "premium",
      price: "~$56",
      why: "Vitamin C targeted at the eye area specifically, where skin is thinner and needs a gentler formula.",
      affiliateUrl: amazonSearch("Kiehl's Powerful-Strength Line-Reducing Eye-Brightening Concentrate"),
    },
  ],
  moisture: [
    {
      id: "cerave-moisturizing-cream",
      brand: "CeraVe",
      name: "Moisturizing Cream",
      category: "Moisturizer",
      tier: "budget",
      price: "~$19",
      why: "Ceramides plus hyaluronic acid — rebuilds the barrier instead of just sitting on top of it.",
      affiliateUrl: amazonSearch("CeraVe Moisturizing Cream"),
    },
    {
      id: "jackblack-double-duty",
      brand: "Jack Black",
      name: "Double-Duty Face Moisturizer SPF 20",
      category: "Moisturizer",
      tier: "premium",
      price: "~$36",
      why: "Built for men's skin specifically — lighter finish than most creams, with SPF folded in.",
      affiliateUrl: amazonSearch("Jack Black Double-Duty Face Moisturizer SPF 20"),
    },
  ],
  radiance: [
    {
      id: "ordinary-vitamin-c",
      brand: "The Ordinary",
      name: "Ascorbyl Glucoside Solution 12%",
      category: "Vitamin C serum",
      tier: "budget",
      price: "~$7",
      why: "A stable, gentle vitamin C derivative — won't oxidize or irritate as fast as pure L-ascorbic acid.",
      affiliateUrl: amazonSearch("The Ordinary Ascorbyl Glucoside Solution 12%"),
    },
    {
      id: "laroche-posay-vitamin-c10",
      brand: "La Roche-Posay",
      name: "Pure Vitamin C10 Serum",
      category: "Vitamin C serum",
      tier: "premium",
      price: "~$40",
      why: "10% pure L-ascorbic acid — the well-studied, higher-strength form, in a formula built for sensitive skin.",
      affiliateUrl: amazonSearch("La Roche-Posay Pure Vitamin C10 Serum"),
    },
  ],
};

export function getProductRecommendations(concern: TrackedMetric | "radiance"): Product[] {
  return PRODUCTS[concern] ?? [];
}
