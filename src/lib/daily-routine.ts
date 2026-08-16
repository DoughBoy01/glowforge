import { METRIC_META, type TrackedMetric } from "@/lib/metrics";
import { getProductRecommendations, type Product } from "@/lib/products";
import type { CategoryPriority, PriorityLevel } from "@/lib/insights";

export type RoutineSlot = "am" | "pm";

/** Mirrors the `routine_steps.category` enum in `db/schema.ts`. */
export type StepCategory =
  | "cleanser"
  | "sunscreen"
  | "retinoid"
  | "moisturizer"
  | "treatment"
  | "shaving"
  | "other";

export type StepKey = "cleanse" | "vitamin_c" | "retinoid" | "eye" | "moisturize" | "spf";

export interface DailyStep {
  key: StepKey;
  /** What the product is, not a brand — "SPF 30+ sunscreen", not "EltaMD". */
  name: string;
  category: StepCategory;
  /** The instruction: exactly what to do with it, in imperative form. */
  how: string;
  /** Why it's in *their* plan, tied to the score that put it there. */
  why: string;
  /** "Every morning", "3 nights a week" — the step's own cadence, which isn't always the routine's. */
  frequency: string;
  /** Rough effort, used to tell them up front how long the routine takes. */
  seconds: number;
  /** Which score put this step in the plan, if any. Cleansing is in every plan regardless. */
  metric: TrackedMetric | "radiance" | null;
  metricLabel: string | null;
  level: PriorityLevel | null;
  /** Set on the day's first step for their worst category — the one to protect if they only keep one. */
  isPriority: boolean;
  products: Product[];
}

export interface DailyRoutine {
  slot: RoutineSlot;
  /** Doubles as the saved routine's name, so the app and the DB agree on what it's called. */
  name: string;
  /** One line of framing above the steps. */
  summary: string;
  durationLabel: string;
  steps: DailyStep[];
}

/**
 * Why a step is in the plan, worded for the severity that put it there — a
 * "critical" score gets urgent, why-this-matters framing while "excellent"
 * gets a maintenance nudge. Keeps the routine from reading like the same
 * four sentences regardless of how someone actually scored.
 */
const WHY_COPY: Record<TrackedMetric, Record<PriorityLevel, string>> = {
  sun_damage: {
    critical:
      "Sun damage scored in the red, and SPF is the highest-leverage fix available — it stops new UV damage while everything else works on repairing what's already there.",
    needs_work:
      "Sun protection isn't consistent enough yet. Every morning, rain or shine, is the target.",
    on_track:
      "Sun protection is holding. Don't let it slip on cloudy days or through winter — UV damage is cumulative.",
    excellent: "Your sun protection is working. This step is the reason it is.",
  },
  firmness: {
    critical:
      "Firmness scored in the red. A retinoid is the most-studied ingredient for stimulating collagen — start at low frequency to build tolerance, then work up.",
    needs_work:
      "A modest retinoid habit now starts rebuilding collagen production before the deficit gets bigger.",
    on_track:
      "Firmness is holding steady. Keep the frequency consistent rather than reaching for a higher strength.",
    excellent: "Strong structural skin health. This is maintenance, not a problem to solve.",
  },
  eye_area: {
    critical:
      "Skin under the eyes is thinner and behaves differently to the rest of your face. It needs dedicated product, not whatever's left on your hands from the moisturizer step.",
    needs_work:
      "A consistent nightly habit here moves puffiness and fine lines faster than an occasional one.",
    on_track: "Eye area is stable, and consistency is what's keeping it that way.",
    excellent: "Eye area is performing well. Low effort is all it needs right now.",
  },
  moisture: {
    critical:
      "Moisture scored in the red, and a compromised barrier makes every other product on this list perform worse. Fix this and the rest works harder.",
    needs_work:
      "Applying moisturizer while skin is still damp does more for hydration than the ingredient list does.",
    on_track: "Hydration is solid. Twice-daily consistency is what to protect here.",
    excellent: "Excellent barrier health. Keep doing exactly this.",
  },
};

const RADIANCE_WHY =
  "Radiance came back lower than your other scores. Vitamin C evens tone and adds antioxidant protection that works alongside your SPF rather than replacing it.";

/**
 * Retinoid cadence, ramped by how far behind firmness is. Nobody quits a
 * retinoid because it didn't work — they quit in week two because they went
 * nightly from a standing start and their face peeled. Starting low is the
 * whole trick.
 */
const RETINOID_SCHEDULE: Record<PriorityLevel, { frequency: string; how: string }> = {
  critical: {
    frequency: "2 nights a week, then build up",
    how: "Pea-sized amount for the entire face, on completely dry skin — damp skin drives it in harder and that's what causes the peeling. Two nights a week for the first month, then three. Skip the eyelids and the corners of your nose.",
  },
  needs_work: {
    frequency: "3 nights a week",
    how: "Pea-sized amount on completely dry skin, three nights a week. If your skin feels tight or flaky the next morning, drop back a night rather than quitting.",
  },
  on_track: {
    frequency: "3-4 nights a week",
    how: "Pea-sized amount on dry skin. Hold your current nights instead of increasing strength — consistency beats potency here.",
  },
  excellent: {
    frequency: "Keep your current nights",
    how: "Pea-sized amount on dry skin. Nothing to change.",
  },
};

function levelFor(priorities: CategoryPriority[], metric: TrackedMetric): PriorityLevel {
  return priorities.find((p) => p.metric === metric)?.level ?? "needs_work";
}

/**
 * Radiance isn't one of the four tracked metrics — it comes straight off the
 * raw YouCam concern scores — so it has no entry in `getCategoryPriorities`
 * and needs its own level derivation. Exported because `lib/prime-move`
 * ranks radiance against the tracked four and the two have to agree on how
 * bad "bad" is, or the single recommendation and the routine can disagree
 * about the same scan.
 */
export function radianceScore(concernScores: { concern: string; uiScore: number }[]) {
  return concernScores.find((c) => c.concern === "radiance")?.uiScore;
}

export function radianceLevelFor(radiance: number | undefined): PriorityLevel {
  if (radiance === undefined || radiance >= 60) return "on_track";
  return radiance < 40 ? "critical" : "needs_work";
}

/**
 * Product picks are attached only where a score says something is actually
 * behind. Someone whose moisture is already excellent doesn't need a
 * moisturizer recommendation — putting an affiliate link there anyway is
 * how a plan stops reading like advice and starts reading like a catalog.
 */
function productsFor(metric: TrackedMetric | "radiance", level: PriorityLevel): Product[] {
  if (level !== "critical" && level !== "needs_work") return [];
  return getProductRecommendations(metric);
}

/**
 * Builds the two routines a man actually runs — morning and evening — from
 * the same ranked priorities the results page already computes.
 *
 * The ordering is fixed by how the products work, not by how badly each
 * category scored: cleanse first, thinnest to thickest in between, SPF last
 * in the morning, retinoid at night only and never in the same routine as
 * vitamin C. Their scores decide which steps are *in* the plan and how hard
 * each one is pushed — the sequence itself isn't negotiable, which is
 * exactly why we don't ask them to assemble it themselves.
 *
 * Deliberately capped at five morning steps and four at night. A plan
 * nobody runs on a Tuesday is worth less than a shorter one they do.
 */
export function buildDailyRoutines(
  priorities: CategoryPriority[],
  concernScores: { concern: string; uiScore: number }[] = [],
): DailyRoutine[] {
  if (priorities.length === 0) return [];

  // `getCategoryPriorities` sorts ascending, so the head is the weakest
  // category — but only worth singling out if it's actually behind. On a
  // scan where everything is strong there is no "start here", and saying
  // there is teaches people to ignore the flag.
  const weakest = priorities[0];
  const priorityMetric =
    weakest.level === "critical" || weakest.level === "needs_work" ? weakest.metric : null;
  const sun = levelFor(priorities, "sun_damage");
  const firm = levelFor(priorities, "firmness");
  const eyes = levelFor(priorities, "eye_area");
  const moist = levelFor(priorities, "moisture");

  // Radiance isn't one of the four tracked metrics but is a real male 35+
  // concern, so it comes straight off the raw YouCam concern scores.
  const radiance = radianceScore(concernScores);
  const needsVitaminC = radiance !== undefined && radiance < 70;
  const radianceLevel = radianceLevelFor(radiance);

  const amSteps: DailyStep[] = [
    {
      key: "cleanse",
      name: "Gentle cleanser",
      category: "cleanser",
      how: "Lukewarm water, a pea-sized amount, twenty seconds. Pat dry with a clean towel — don't scrub.",
      why: "Clears the oil and sweat that built up overnight so everything after it can actually absorb.",
      frequency: "Every morning",
      seconds: 30,
      metric: null,
      metricLabel: null,
      level: null,
      isPriority: false,
      products: [],
    },
  ];

  if (needsVitaminC) {
    amSteps.push({
      key: "vitamin_c",
      name: "Vitamin C serum",
      category: "treatment",
      how: "Three or four drops on dry skin. Spread across forehead, cheeks, and jaw, then give it thirty seconds to sink in before the next step.",
      why: RADIANCE_WHY,
      frequency: "Every morning",
      seconds: 40,
      metric: "radiance",
      metricLabel: "Radiance",
      level: radianceLevel,
      isPriority: false,
      products: productsFor("radiance", radianceLevel),
    });
  }

  amSteps.push(
    {
      key: "moisturize",
      name: "Moisturizer",
      category: "moisturizer",
      how: "Nickel-sized amount, while your face is still slightly damp — within sixty seconds of washing. Face and neck.",
      why: WHY_COPY.moisture[moist],
      frequency: "Every morning",
      seconds: 30,
      metric: "moisture",
      metricLabel: METRIC_META.moisture.label,
      level: moist,
      isPriority: false,
      products: productsFor("moisture", moist),
    },
    {
      key: "spf",
      name: "Broad-spectrum SPF 30+",
      category: "sunscreen",
      how: "Two fingers' worth across face, ears, and neck. Always the last thing you put on in the morning. If your moisturizer already has SPF 30+, that covers this step — don't layer two.",
      why: WHY_COPY.sun_damage[sun],
      frequency: "Every morning, indoors days included",
      seconds: 30,
      metric: "sun_damage",
      metricLabel: METRIC_META.sun_damage.label,
      level: sun,
      isPriority: false,
      products: productsFor("sun_damage", sun),
    },
  );

  const pmSteps: DailyStep[] = [
    {
      key: "cleanse",
      name: "Gentle cleanser",
      category: "cleanser",
      how: "Same twenty seconds, but this one matters more — it's taking off a day of sunscreen, sweat, and grime that would otherwise sit on your face for eight hours.",
      why: "Anything you apply tonight lands on clean skin or it doesn't land at all.",
      frequency: "Every night",
      seconds: 30,
      metric: null,
      metricLabel: null,
      level: null,
      isPriority: false,
      products: [],
    },
  ];

  if (firm !== "excellent") {
    pmSteps.push({
      key: "retinoid",
      name: "Retinoid",
      category: "retinoid",
      how: RETINOID_SCHEDULE[firm].how,
      why: WHY_COPY.firmness[firm],
      frequency: RETINOID_SCHEDULE[firm].frequency,
      seconds: 30,
      metric: "firmness",
      metricLabel: METRIC_META.firmness.label,
      level: firm,
      isPriority: false,
      products: productsFor("firmness", firm),
    });
  }

  if (eyes !== "excellent") {
    pmSteps.push({
      key: "eye",
      name: "Eye treatment",
      category: "treatment",
      how: "One grain of rice per eye. Ring finger only — it's the weakest one, so you tap instead of dragging. Along the orbital bone, not the lid.",
      why: WHY_COPY.eye_area[eyes],
      frequency: "Every night",
      seconds: 30,
      metric: "eye_area",
      metricLabel: METRIC_META.eye_area.label,
      level: eyes,
      isPriority: false,
      products: productsFor("eye_area", eyes),
    });
  }

  pmSteps.push({
    key: "moisturize",
    name: "Moisturizer",
    category: "moisturizer",
    how: "Seal the night's work in. Go heavier than your morning layer if your skin feels tight — especially on retinoid nights.",
    why: WHY_COPY.moisture[moist],
    frequency: "Every night",
    seconds: 30,
    metric: "moisture",
    metricLabel: METRIC_META.moisture.label,
    level: moist,
    isPriority: false,
    products: productsFor("moisture", moist),
  });

  // Flag the day's *first* appearance only: moisture shows up morning and
  // night, and two "start here" badges is the same as none.
  if (priorityMetric) {
    const first = [...amSteps, ...pmSteps].find((step) => step.metric === priorityMetric);
    if (first) first.isPriority = true;
  }

  return [
    {
      slot: "am",
      name: "Morning routine",
      summary: "Protect. Everything here is about stopping new damage before the day starts.",
      durationLabel: durationLabel(amSteps),
      steps: amSteps,
    },
    {
      slot: "pm",
      name: "Evening routine",
      summary: "Repair. This is where the actual score movement comes from.",
      durationLabel: durationLabel(pmSteps),
      steps: pmSteps,
    },
  ];
}

/** Stated up front, because "how long is this going to take" is the first objection. */
function durationLabel(steps: DailyStep[]): string {
  const total = steps.reduce((sum, s) => sum + s.seconds, 0);
  const time =
    total < 75
      ? "under a minute"
      : total < 105
        ? "about 90 seconds"
        : `about ${Math.round(total / 60)} minutes`;
  return `${steps.length} steps · ${time}`;
}

/**
 * The handful of rules that break a routine when they're broken, ranked
 * above any product choice. Shown once under the plan rather than repeated
 * on every step that touches them.
 */
export const ROUTINE_RULES: string[] = [
  "SPF is the last step of the morning, over the top of everything else. Under moisturizer it does noticeably less.",
  "Retinoid is a night-only ingredient, and never in the same routine as vitamin C — that's why one sits in the morning and one at night.",
  "Miss a day, run the next one. A skipped step is a skipped step; a quit routine is eight weeks gone.",
  "Give it eight to twelve weeks before you judge it. Skin turns over slowly — your next few scans will show it well before the mirror does.",
];
