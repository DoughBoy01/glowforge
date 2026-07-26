import { TRACKED_METRICS, type TrackedMetric } from "@/lib/metrics";

export type PriorityLevel = "critical" | "needs_work" | "on_track" | "excellent";

export interface CategoryPriority {
  metric: TrackedMetric;
  score: number;
  level: PriorityLevel;
  label: string;
  guidance: string;
  /** vs. the previous scan's score for this metric, if one exists. */
  delta: number | null;
}

const LEVEL_COPY: Record<PriorityLevel, { label: string; guidance: string }> = {
  critical: {
    label: "Critical",
    guidance: "Your lowest-scoring category — prioritize this in your routine.",
  },
  needs_work: {
    label: "Needs work",
    guidance: "Below where it should be. Worth a dedicated routine step.",
  },
  on_track: {
    label: "On track",
    guidance: "Solid and stable — keep the current routine going.",
  },
  excellent: {
    label: "Excellent",
    guidance: "Performing well. Maintenance mode.",
  },
};

function levelForScore(score: number): PriorityLevel {
  if (score < 40) return "critical";
  if (score < 60) return "needs_work";
  if (score < 80) return "on_track";
  return "excellent";
}

/**
 * Ranks the four tracked metrics worst-first, so the dashboard/routine page
 * can point at exactly what to work on next instead of showing four
 * equally-weighted numbers and leaving the user to do the comparison.
 */
export function getCategoryPriorities(
  latestScores: Record<TrackedMetric, number>,
  previousScores?: Record<TrackedMetric, number> | null,
): CategoryPriority[] {
  return [...TRACKED_METRICS]
    .map((metric) => {
      const score = latestScores[metric];
      const level = levelForScore(score);
      return {
        metric,
        score,
        level,
        label: LEVEL_COPY[level].label,
        guidance: LEVEL_COPY[level].guidance,
        delta: previousScores ? score - previousScores[metric] : null,
      };
    })
    .sort((a, b) => a.score - b.score);
}

export interface SkinAgeInsight {
  skinAge: number;
  deltaFromPrevious: number | null;
  message: string;
}

/** Skin age is only ever compared to the user's own history — we don't collect chronological age. */
export function getSkinAgeInsight(
  skinAge: number,
  previousSkinAge: number | null,
): SkinAgeInsight {
  const delta = previousSkinAge === null ? null : skinAge - previousSkinAge;
  let message = `Estimated skin age: ${skinAge}.`;
  if (delta !== null && delta !== 0) {
    message +=
      delta < 0
        ? ` Down ${Math.abs(delta)} since your last scan — trending younger.`
        : ` Up ${delta} since your last scan.`;
  } else if (delta === 0) {
    message += " Unchanged since your last scan.";
  }
  return { skinAge, deltaFromPrevious: delta, message };
}

export interface ProjectedScore {
  metric: TrackedMetric;
  current: number;
  projected: number;
  level: PriorityLevel;
}

/** How many points a category could realistically gain over ~8-12 weeks of consistent routine adherence. Larger for lower-scoring categories — there's more low-hanging fruit (sunscreen, hydration) to capture. Not a clinical prediction, just a motivational, data-grounded target. */
const PROJECTED_GAIN: Record<PriorityLevel, number> = {
  critical: 18,
  needs_work: 12,
  on_track: 6,
  excellent: 2,
};

/**
 * Pairs each category's current score with a realistic near-term target,
 * for the "current vs improved" visualization on the results page. This is
 * intentionally a projection grounded in the user's own measured scores —
 * not a synthesized "after" photo, which would be both misleading and
 * outside what any of our data actually supports.
 */
export function getProjectedScores(priorities: CategoryPriority[]): ProjectedScore[] {
  return priorities.map((p) => ({
    metric: p.metric,
    current: p.score,
    projected: Math.min(100, p.score + PROJECTED_GAIN[p.level]),
    level: p.level,
  }));
}

export interface WindowedTrend {
  metric: TrackedMetric | "overall";
  currentScore: number;
  windowStartScore: number | null;
  delta: number | null;
  windowDays: number;
}

/**
 * Compares the latest score against the earliest score at least
 * `windowDays` old. `history` must be chronological oldest-first, matching
 * `getMetricTrend`'s return order.
 */
export function computeWindowedTrend(
  history: { createdAt: Date; score: number }[],
  metric: TrackedMetric | "overall",
  windowDays = 30,
): WindowedTrend {
  const current = history.at(-1) ?? null;
  const cutoff = current ? current.createdAt.getTime() - windowDays * 86_400_000 : 0;
  const windowStart = current ? (history.find((h) => h.createdAt.getTime() >= cutoff) ?? null) : null;

  return {
    metric,
    currentScore: current?.score ?? 0,
    windowStartScore: windowStart ? windowStart.score : null,
    delta:
      current && windowStart && windowStart !== current
        ? current.score - windowStart.score
        : null,
    windowDays,
  };
}
