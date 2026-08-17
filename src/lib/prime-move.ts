import { METRIC_META, type TrackedMetric } from "@/lib/metrics";
import { getProductRecommendations, type Product } from "@/lib/products";
import { radianceLevelFor, radianceScore } from "@/lib/daily-routine";
import type { CategoryPriority, PriorityLevel } from "@/lib/insights";

export type PrimeMoveMetric = TrackedMetric | "radiance";

/**
 * The named high-street chains, so "go and buy one" doesn't turn into a
 * research project. Region-specific — this list and `PRODUCTS`'s store links
 * in `lib/products.ts` have to describe the same country, so change both
 * together if the app opens outside the UK.
 */
export const HIGH_STREET_RETAILERS = ["Boots", "Superdrug"] as const;

/**
 * Which of the two below-par levels a move is being recommended at, plus
 * `holding` — the case where nothing is actually behind and the single move
 * is the one that protects the result instead of chasing a gain.
 */
type MoveTone = "critical" | "needs_work" | "holding";

interface MoveCopy {
  /** Codename for the product class. The thing they're being sent to buy is a category, not a brand. */
  codename: string;
  /** Plain-words version of the same thing, for the badge: "Retinol serum". */
  productClass: string;
  /** The spec to shop against — concentrations and label words, no brands. */
  spec: string;
  /** Everything they need to use it correctly, in one line. */
  how: string;
  /** Why this one, tied to the reading that chose it. `holding` only exists where a maintenance framing makes sense. */
  because: Partial<Record<MoveTone, string>> & { needs_work: string };
}

/**
 * One move per concern, written for a man who has never bought a skincare
 * product and does not want a lecture. Two constraints on this copy:
 *
 * 1. The spec has to be shoppable from memory — a concentration and a word
 *    that appears on the front of the bottle. "A retinol serum with 0.25-0.5%
 *    retinol" survives the walk to the shop; "a retinoid" does not.
 * 2. The how has to be complete. This is deliberately the *only* instruction
 *    someone taking this path will read, so it carries the frequency, the
 *    amount, and the one mistake that makes people quit.
 */
const MOVES: Record<PrimeMoveMetric, MoveCopy> = {
  moisture: {
    codename: "The Barrier",
    productClass: "Moisturizer",
    spec: "Look for a fragrance-free moisturizer with ceramides — it'll say so on the front of the tub.",
    how: "A nickel-sized amount, morning and night, within a minute of washing while your face is still slightly damp. Face and neck.",
    because:
      {
        critical:
          "Moisture came back as your weakest reading, and a dry, stressed barrier makes every other product perform worse. It's the first thing to fix and the easiest one on the board.",
        needs_work:
          "Moisture is the reading with the most room in it, and it's the least demanding fix you have — no ramp-up, no side effects, works from day one.",
      },
  },
  sun_damage: {
    codename: "The Shield",
    productClass: "Sunscreen",
    spec: "Look for a broad-spectrum SPF 30 or higher. If there's a UVA logo in a circle on the bottle, it's the right kind.",
    how: "Two fingers' worth across face, ears and neck every morning — the last thing you put on, cloudy days and indoor days included.",
    because: {
      critical:
        "Sun damage is your weakest reading, and sunscreen is the only thing available that stops it getting worse today. Nothing else here has that kind of leverage.",
      needs_work:
        "Sun protection isn't consistent enough to be doing its job yet. Wearing it daily matters far more than which one you buy.",
      holding:
        "Nothing's behind, so the move is protecting what you've already got — and sunscreen is what holds a score where it is.",
    },
  },
  firmness: {
    codename: "The Restorer",
    productClass: "Retinol serum",
    spec: "Look for a retinol serum with 0.25-0.5% retinol. Anything stronger is not a faster result, it's a worse first month.",
    how: "A pea-sized amount on completely dry skin, two nights a week to start, then build up. Night only. If your skin feels tight the next morning, drop back a night rather than stopping.",
    because: {
      critical:
        "Firmness is your weakest reading. Retinol is the most-studied ingredient there is for it, and 0.25-0.5% is strong enough to work without the peeling that makes most men quit in week two.",
      needs_work:
        "Firmness has the most room to move, and retinol has decades of evidence behind it. Start low — the strength you'll actually keep up beats the strength you won't.",
    },
  },
  radiance: {
    codename: "The Brightener",
    productClass: "Vitamin C serum",
    spec: "Look for a vitamin C serum at 10-15%, in a dark or opaque bottle — a clear one lets it go off before you finish it.",
    how: "Three or four drops on dry skin every morning, before your moisturizer. Morning only — it works alongside sunscreen, not instead of it.",
    because: {
      critical:
        "Radiance came back well below your other readings. Vitamin C is the most direct fix for uneven, dull tone, and it adds antioxidant cover on top of what sunscreen does.",
      needs_work:
        "Radiance is the reading with the most room. Vitamin C evens tone and lays down a second layer of protection alongside your sunscreen.",
    },
  },
  eye_area: {
    codename: "The Reviver",
    productClass: "Eye serum",
    spec: "Look for an eye serum with caffeine at around 5%.",
    how: "One grain of rice per eye, at night. Ring finger only — it's the weakest, so you tap rather than drag. Along the bone under the eye, never on the lid.",
    because: {
      critical:
        "The eye area is your weakest reading. The skin there is thinner than the rest of your face and doesn't respond to the same products, which is the one place a dedicated product genuinely earns its place.",
      needs_work:
        "Eye area has the most room to move, and caffeine is the most direct thing available for the puffiness under there.",
    },
  },
};

/**
 * Which concern wins when several are equally bad. Not the order they scored
 * in — the order they *unlock* each other in. A wrecked barrier makes a
 * retinoid hurt, and sunscreen is the only step that stops the clock rather
 * than trying to wind it back, so those two come before anything corrective.
 * Eye cream is last because it's the narrowest fix on the board.
 */
const LEVERAGE_ORDER: PrimeMoveMetric[] = [
  "moisture",
  "sun_damage",
  "firmness",
  "radiance",
  "eye_area",
];

const READY_PREFIX: Record<MoveTone, string> = {
  critical: "Your skin is asking for",
  needs_work: "Your skin is ready for",
  holding: "You're holding. What keeps you there is",
};

export interface PrimeMove {
  /** "The Restorer" — the display hero of the card. */
  codename: string;
  /** The half-sentence that leads into the codename, so the card reads as one line. */
  readyPrefix: string;
  metric: PrimeMoveMetric;
  metricLabel: string;
  level: PriorityLevel;
  productClass: string;
  spec: string;
  /** "You can find this at Boots, Superdrug, or online." */
  where: string;
  because: string;
  how: string;
  /** Curated picks for this concern, shown only behind a disclosure. Never the lead. */
  options: Product[];
}

function levelsFor(
  priorities: CategoryPriority[],
  concernScores: { concern: string; uiScore: number }[],
): Map<PrimeMoveMetric, PriorityLevel> {
  const levels = new Map<PrimeMoveMetric, PriorityLevel>(
    priorities.map((p) => [p.metric as PrimeMoveMetric, p.level]),
  );
  levels.set("radiance", radianceLevelFor(radianceScore(concernScores)));
  return levels;
}

/**
 * The single highest-leverage thing to buy and do, from one scan.
 *
 * This exists because the full routine is the right answer for someone who
 * wants a routine and the wrong answer for everyone else — five steps and
 * eight product links is a wall, and a wall gets nothing done. So the same
 * scores produce a second, much smaller output: one product class, one spec,
 * one instruction. It isn't a lighter version of the plan, it's the first
 * rung of it, and every step it names is already in the plan verbatim.
 *
 * Selection is worst-level-first, then by `LEVERAGE_ORDER` within that level
 * — never by raw score. Two categories both scoring "critical" is common, and
 * picking on a two-point difference between them would send someone to buy an
 * eye serum while their barrier is shot.
 */
export function buildPrimeMove(
  priorities: CategoryPriority[],
  concernScores: { concern: string; uiScore: number }[] = [],
): PrimeMove | null {
  if (priorities.length === 0) return null;

  const levels = levelsFor(priorities, concernScores);
  const at = (level: PriorityLevel) =>
    LEVERAGE_ORDER.find((metric) => levels.get(metric) === level);

  // Nothing behind: fall through to sunscreen, which is the only concern with
  // a maintenance framing — "keep doing this" is a real answer for it in a way
  // that "keep buying retinol you don't need" is not.
  const metric = at("critical") ?? at("needs_work") ?? "sun_damage";
  const level = levels.get(metric) ?? "on_track";
  const tone: MoveTone =
    level === "critical" || level === "needs_work" ? level : "holding";

  const copy = MOVES[metric];
  const retailers = HIGH_STREET_RETAILERS.join(", ");

  return {
    codename: copy.codename,
    readyPrefix: READY_PREFIX[tone],
    metric,
    metricLabel: metric === "radiance" ? "Radiance" : METRIC_META[metric].label,
    level,
    productClass: copy.productClass,
    spec: copy.spec,
    where: `You can find this at ${retailers}, or online.`,
    because: copy.because[tone] ?? copy.because.needs_work,
    how: copy.how,
    // Curated picks are attached only where something is actually behind —
    // the same rule `productsFor` follows in the routine. On a holding scan
    // there is nothing to sell and pretending otherwise is how advice turns
    // into a catalog.
    options: tone === "holding" ? [] : getProductRecommendations(metric),
  };
}
