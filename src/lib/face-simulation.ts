import { TRACKED_METRICS, METRIC_META, type TrackedMetric } from "@/lib/metrics";
import { CONCERN_META } from "@/lib/concerns";
import type { YouCamConcern } from "@/lib/youcam/types";
import type { SimulationParam } from "@/lib/youcam/constants";

/**
 * Turns a measured scan plus a goal into skin-simulation parameters — the
 * "where this could get to" image on the results page.
 *
 * The whole file exists to answer one question honestly: given that this
 * person's pores score 41, how much pore correction should the picture show?
 * The vendor will happily render 1.0 on every parameter, and it looks
 * fantastic, and it is a lie. Everything below is the machinery for not doing
 * that.
 *
 * Four rules, in the order they're applied:
 *
 * 1. **Headroom.** Correction is proportional to how much room a concern
 *    actually has. Skin already scoring 90 gets almost nothing; there's
 *    nothing to fix and pretending otherwise reads as a filter.
 * 2. **Responsiveness.** Concerns do not improve at the same rate, and some
 *    barely improve at all from anything this app can recommend. Under-eye
 *    bags are usually fat-pad anatomy; no serum moves them. Pore diameter is
 *    largely fixed. Pigmentation takes months. Redness and dullness shift in
 *    weeks. `CONCERN_RESPONSIVENESS` is the ceiling this imposes, and it is
 *    the single most important thing keeping the output plausible.
 * 3. **Focus.** The goal decides what the picture is *about*. Concerns inside
 *    the goal get their full derived value; everything else is damped to a
 *    background level, because a real routine does help broadly — just less,
 *    and less visibly, than the thing being worked on.
 * 4. **Budget.** Even when every individual value is defensible, applying all
 *    of them at once produces a waxwork. The total correction across all
 *    parameters is capped and scaled down proportionally if exceeded.
 *
 * None of this is a clinical prediction, and the UI must not present it as
 * one. It's a picture of a plausible good outcome, which is a different and
 * more defensible claim than a forecast. See `SIMULATION_DISCLAIMER`.
 */

/** Crosswalk from the analysis concern enum to the simulation param names. The two vocabularies differ in ways string munging won't survive — see the note on `SIMULATION_PARAMS`. */
export const SIMULATION_PARAM_FOR_CONCERN: Partial<Record<YouCamConcern, SimulationParam>> = {
  wrinkle: "wrinkle",
  radiance: "radiance",
  acne: "acne",
  eye_bag: "eye_bags",
  dark_circle_v2: "dark_circle",
  age_spot: "spots",
  pore: "pores",
  texture: "texture",
  redness: "redness",
  oiliness: "oiliness",
};

/**
 * Concerns the analysis measures that the simulator has no parameter for:
 * `firmness`, `moisture`, and the two eyelid-droop signals. They still shape
 * the goal indirectly — `moisture` is why `radiance` and `texture` move, and
 * firmness is why `texture` does — but nothing draws them directly, and the
 * UI shouldn't claim the image shows them.
 */
export const UNSIMULATABLE_CONCERNS: YouCamConcern[] = [
  "firmness",
  "moisture",
  "droopy_upper_eyelid",
  "droopy_lower_eyelid",
];

/**
 * How much of the simulator's maximum correction is plausibly reachable for
 * each concern through the work this app actually prescribes — consistent
 * daily skincare, sun protection, sleep, and time. These are deliberately
 * pessimistic; the failure mode of an over-generous number here is a user
 * who feels lied to at their next scan.
 *
 * The ordering is the load-bearing part, and it tracks how each concern
 * responds to topical routine rather than to procedures:
 *  - radiance/redness: surface and vascular, shift within weeks.
 *  - acne: responds well but on a 6-12 week cycle.
 *  - texture: retinoid/exfoliation territory, 8-16 weeks.
 *  - spots: pigmentation turns over slowly and relapses with UV exposure.
 *  - pores: visibility can improve; diameter is structural.
 *  - wrinkle: topicals soften fine lines, they don't fill established creases.
 *  - dark_circle: frequently pigment or vascular anatomy, not skin quality.
 *  - eye_bags: usually herniated fat, which no routine reaches.
 */
const CONCERN_RESPONSIVENESS: Record<SimulationParam, number> = {
  radiance: 0.85,
  acne: 0.75,
  redness: 0.7,
  texture: 0.65,
  spots: 0.45,
  pores: 0.4,
  wrinkle: 0.3,
  dark_circle: 0.3,
  eye_bags: 0.2,
  // Inverted parameter — 1.0 *adds* shine. Never raised for a goal image;
  // `deriveSimulationParams` hard-zeroes it regardless of what's here.
  oiliness: 0,
};

/**
 * Which simulation parameters each tracked metric is "about", so a goal
 * aimed at one category produces a picture of that category.
 *
 * Mirrors `METRIC_CONCERN_WEIGHTS` in `youcam/transform.ts` where the two
 * overlap, and substitutes the visible proxy where a metric's own concerns
 * aren't simulatable: `firmness` and `moisture` have no parameter, so they
 * point at the texture/radiance signals through which they actually show up
 * on a face.
 */
const FOCUS_PARAMS: Record<TrackedMetric, SimulationParam[]> = {
  sun_damage: ["spots", "wrinkle", "redness", "radiance"],
  firmness: ["texture", "wrinkle"],
  eye_area: ["eye_bags", "dark_circle"],
  moisture: ["radiance", "texture"],
};

/** Correction applied to concerns outside the goal's focus. A real routine helps them too — just not as the point of the picture. */
const OFF_FOCUS_DAMPING = 0.45;

/**
 * Hard ceiling on any single parameter. Nothing in a goal image goes above
 * this, however bad the starting score and however responsive the concern.
 * Past roughly this point the vendor's output stops looking like the person
 * in the photo, which costs more trust than the extra improvement buys.
 */
const PER_PARAM_CEILING = 0.65;

/**
 * Ceiling on the *sum* of all parameters. Nine individually-reasonable
 * corrections still add up to an airbrushed stranger, and this is what stops
 * that. Tuned so a typical goal lands 3-4 visible changes rather than a
 * global smoothing pass.
 */
const TOTAL_CORRECTION_BUDGET = 2.2;

/** Below this a parameter is indistinguishable from 0 in the output and only costs realism headroom under the budget. */
const MIN_MEANINGFUL_INTENSITY = 0.08;

/**
 * The horizon the projection is framed against. 12 weeks matches the
 * "~8-12 weeks" the results page already promises on the score projection,
 * so the picture and the bars beneath it describe the same future.
 */
export const DEFAULT_HORIZON_WEEKS = 12;

/** Scales correction by timeframe, saturating rather than growing linearly — the second three months deliver less than the first. */
function horizonFactor(weeks: number): number {
  return Math.min(1, Math.sqrt(Math.max(0, weeks) / DEFAULT_HORIZON_WEEKS));
}

export interface SimulationGoal {
  /** What the picture is about. `overall` weights every concern by its own headroom instead of favoring a category. */
  focus: TrackedMetric | "overall";
  horizonWeeks: number;
}

/** Human-readable name for the goal, for UI copy and stored metadata. */
export function goalLabel(goal: SimulationGoal): string {
  return goal.focus === "overall" ? "Overall skin health" : METRIC_META[goal.focus].label;
}

/**
 * The goal we pick when the user hasn't chosen one: their weakest tracked
 * category. `priorities` comes from `getCategoryPriorities`, which is already
 * sorted worst-first, so this is just "work on what's furthest behind" — the
 * same recommendation the rest of the results page makes in words.
 */
export function defaultGoalFor(
  priorities: { metric: TrackedMetric }[],
  horizonWeeks: number = DEFAULT_HORIZON_WEEKS,
): SimulationGoal {
  return { focus: priorities[0]?.metric ?? "overall", horizonWeeks };
}

export interface DerivedParam {
  param: SimulationParam;
  concern: YouCamConcern;
  label: string;
  /** The measured 1-100 score this was derived from (higher is healthier). */
  currentScore: number;
  /** 0-1 intensity sent to the vendor. */
  intensity: number;
  /** Whether this parameter is part of the goal's focus. */
  inFocus: boolean;
}

export interface DerivedSimulation {
  goal: SimulationGoal;
  params: DerivedParam[];
  /** The wire payload — only non-zero entries, ready to hand to `createSkinSimulationTask`. */
  intensities: Partial<Record<SimulationParam, number>>;
  /** False when nothing was worth simulating (no measured concerns, or skin with no meaningful headroom). */
  isViable: boolean;
}

/** Rounds to 2dp — the vendor takes arbitrary precision, but storing 0.31 beats storing 0.30999999999999994. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Derives the full parameter set from measured concern scores and a goal.
 *
 * `concernScores` are the analysis's `uiScore` values (1-100, higher is
 * healthier) — the same numbers the technical breakdown shows, so the picture
 * is derived from what the user can already see rather than a hidden model.
 *
 * Pure: no vendor calls, no database. That's deliberate, so the numbers this
 * produces can be reasoned about and adjusted without spending credits.
 */
export function deriveSimulationParams(
  concernScores: { concern: string; uiScore: number }[],
  goal: SimulationGoal,
): DerivedSimulation {
  const focusSet = new Set<SimulationParam>(
    goal.focus === "overall"
      ? (Object.keys(CONCERN_RESPONSIVENESS) as SimulationParam[])
      : FOCUS_PARAMS[goal.focus],
  );
  const horizon = horizonFactor(goal.horizonWeeks);

  const derived: DerivedParam[] = [];

  for (const row of concernScores) {
    const param = SIMULATION_PARAM_FOR_CONCERN[row.concern as YouCamConcern];
    if (!param) continue; // measured but not simulatable — see UNSIMULATABLE_CONCERNS

    // Oiliness is inverted at the vendor (1.0 adds shine). There is no value
    // that improves a face here, so it stays out of goal images entirely.
    if (param === "oiliness") continue;

    const score = Math.max(0, Math.min(100, row.uiScore));
    const headroom = (100 - score) / 100;
    const inFocus = focusSet.has(param);

    const intensity =
      headroom *
      CONCERN_RESPONSIVENESS[param] *
      horizon *
      (inFocus ? 1 : OFF_FOCUS_DAMPING);

    derived.push({
      param,
      concern: row.concern as YouCamConcern,
      label: CONCERN_META[row.concern as YouCamConcern]?.label ?? param,
      currentScore: score,
      intensity: Math.min(PER_PARAM_CEILING, intensity),
      inFocus,
    });
  }

  // Drop the invisible ones before budgeting, so they don't consume budget
  // that a visible change could have used.
  const meaningful = derived.filter((d) => d.intensity >= MIN_MEANINGFUL_INTENSITY);

  const total = meaningful.reduce((sum, d) => sum + d.intensity, 0);
  const budgetScale = total > TOTAL_CORRECTION_BUDGET ? TOTAL_CORRECTION_BUDGET / total : 1;

  const scaled = meaningful
    .map((d) => ({ ...d, intensity: round2(d.intensity * budgetScale) }))
    // Scaling can push a borderline value back under the visibility floor.
    .filter((d) => d.intensity > 0)
    .sort((a, b) => b.intensity - a.intensity);

  return {
    goal,
    params: scaled,
    intensities: Object.fromEntries(scaled.map((d) => [d.param, d.intensity])),
    isViable: scaled.length > 0,
  };
}

/**
 * The line that has to appear anywhere this image does.
 *
 * The results page deliberately shipped a numeric projection instead of a
 * synthesized "after" photo, on the grounds that a fake face works against
 * the trust the page is built to earn. That reasoning didn't go away when
 * this feature landed — the image is allowed to exist because it's derived
 * from the user's own measurements, capped at what routine can plausibly do,
 * and labelled as a simulation rather than a forecast. Remove the label and
 * the original objection is correct again.
 */
export const SIMULATION_DISCLAIMER =
  "A simulation, not a prediction. Generated from this scan's own scores and capped at what a consistent routine can realistically do — results vary, and nothing here is a promise.";

/** Short-form for tight spaces (share cards, badges). */
export const SIMULATION_BADGE = "Simulated";

/**
 * One-line summary of what the image is showing, e.g.
 * "Softer texture, clearer skin and less redness". Built from the parameters
 * actually applied, so the sentence can't overclaim relative to the picture.
 */
export function describeSimulation(sim: DerivedSimulation): string {
  const PHRASES: Record<SimulationParam, string> = {
    wrinkle: "softer lines",
    radiance: "brighter tone",
    acne: "clearer skin",
    eye_bags: "less under-eye puffiness",
    dark_circle: "lighter dark circles",
    spots: "more even pigment",
    pores: "less visible pores",
    texture: "smoother texture",
    redness: "calmer redness",
    oiliness: "less shine",
  };

  // Focus first, then strongest — a goal aimed at the eye area has to lead
  // with the eye area even when an off-focus concern happens to move more.
  const ordered = [...sim.params].sort(
    (a, b) => Number(b.inFocus) - Number(a.inFocus) || b.intensity - a.intensity,
  );
  const top = ordered.slice(0, 3).map((p) => PHRASES[p.param]);
  if (top.length === 0) return "No meaningful change to simulate.";
  if (top.length === 1) return capitalize(top[0]);
  return capitalize(`${top.slice(0, -1).join(", ")} and ${top[top.length - 1]}`);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The tracked metrics a user can aim a goal at, for a future goal picker. */
export const GOAL_OPTIONS: (TrackedMetric | "overall")[] = ["overall", ...TRACKED_METRICS];

export interface ResolvedGoalPreview {
  goal: SimulationGoal;
  summary: string;
  params: { label: string; intensity: number; currentScore: number; inFocus: boolean }[];
}

/**
 * Everything a `GoalPreview` card needs for one scan, from the stored
 * simulation row plus that scan's raw concern scores. The one function every
 * screen that shows the goal image (results page, home dashboard) calls,
 * so "what goal is this, and what does it change" can't drift between them.
 *
 * Re-derives from `concernScores` rather than trusting `simulation.params`
 * for the *labels and focus flags* — but the actual strengths shown always
 * come from what was sent (`simulation.params`) when a row exists, via the
 * `sentIntensities` filter/override below. That split matters because the
 * intensity model in this file can be retuned after a simulation was already
 * generated; without it, an old image would silently relabel itself with
 * today's numbers instead of the ones that produced the picture next to it.
 */
export function resolveGoalPreview(params: {
  simulation:
    | { goalFocus: TrackedMetric | "overall"; goalHorizonWeeks: number; params: string | null }
    | null
    | undefined;
  concernScores: { concern: string; uiScore: number }[];
  /** Worst-first tracked metrics, from `getCategoryPriorities` — only consulted when no simulation row exists yet, to pick the same default goal `runGoalSimulationForScan` would. */
  priorities: { metric: TrackedMetric }[];
}): ResolvedGoalPreview {
  const goal = params.simulation
    ? { focus: params.simulation.goalFocus, horizonWeeks: params.simulation.goalHorizonWeeks }
    : defaultGoalFor(params.priorities, DEFAULT_HORIZON_WEEKS);

  const derived = deriveSimulationParams(params.concernScores, goal);
  const sentIntensities = params.simulation?.params
    ? (JSON.parse(params.simulation.params) as Record<string, number>)
    : null;

  const resolvedParams = derived.params
    .filter((p) => !sentIntensities || p.param in sentIntensities)
    .map((p) => ({
      label: p.label,
      intensity: sentIntensities?.[p.param] ?? p.intensity,
      currentScore: p.currentScore,
      inFocus: p.inFocus,
    }))
    .sort((a, b) => b.intensity - a.intensity);

  return { goal, summary: describeSimulation(derived), params: resolvedParams };
}
