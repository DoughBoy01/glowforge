/**
 * The four measured dimensions GlowForge tracks, plus the derived
 * "overall" composite. Single source of truth for labels/order/weights so
 * the check-in form, dashboard charts, and share cards can't drift apart.
 */
export const TRACKED_METRICS = [
  "sun_damage",
  "firmness",
  "eye_area",
  "moisture",
] as const;

export type TrackedMetric = (typeof TRACKED_METRICS)[number];
export type MetricType = TrackedMetric | "overall";

export const METRIC_META: Record<
  TrackedMetric,
  { label: string; short: string; description: string; chartVar: string; weight: number }
> = {
  sun_damage: {
    label: "Sun Damage",
    short: "Sun",
    description: "UV-related pigmentation, texture, and visible photoaging.",
    chartVar: "var(--chart-1)",
    weight: 0.3,
  },
  firmness: {
    label: "Firmness",
    short: "Firm",
    description: "Skin elasticity and structural density.",
    chartVar: "var(--chart-2)",
    weight: 0.3,
  },
  eye_area: {
    label: "Eye Area",
    short: "Eyes",
    description: "Under-eye puffiness, dark circles, and fine lines.",
    chartVar: "var(--chart-3)",
    weight: 0.2,
  },
  moisture: {
    label: "Moisture",
    short: "Hydration",
    description: "Barrier hydration and surface water content.",
    chartVar: "var(--chart-4)",
    weight: 0.2,
  },
};

export const OVERALL_META = {
  label: "Overall Score",
  short: "Overall",
  chartVar: "var(--chart-5)",
};

/** Weighted composite from the four tracked metrics. Result is 0-100. */
export function computeOverallScore(scores: Record<TrackedMetric, number>): number {
  const total = TRACKED_METRICS.reduce(
    (sum, metric) => sum + scores[metric] * METRIC_META[metric].weight,
    0,
  );
  return Math.round(total);
}

/** Looks up one metric's score out of a scan's metricScores rows — null if that metric hasn't been scored yet (e.g. AI analysis still in flight). */
export function scoreForMetric(
  scores: { metricType: string; score: number }[] | undefined,
  type: MetricType,
): number | null {
  return scores?.find((m) => m.metricType === type)?.score ?? null;
}

/**
 * All four tracked scores for one scan, or null if any of them is still
 * missing. Anything that ranks or plans off a full picture (priorities,
 * projections, the generated routine) needs the complete set — a partial
 * one would quietly rank against a zero.
 */
export function trackedScores(
  scores: { metricType: string; score: number }[] | undefined,
): Record<TrackedMetric, number> | null {
  const entries = TRACKED_METRICS.map((m) => [m, scoreForMetric(scores, m)] as const);
  if (entries.some(([, score]) => score === null)) return null;
  return Object.fromEntries(entries) as Record<TrackedMetric, number>;
}

export function scoreDeltaLabel(current: number, previous: number | null): string {
  if (previous === null) return "First scan";
  const delta = current - previous;
  if (delta === 0) return "No change";
  return delta > 0 ? `+${delta}` : `${delta}`;
}
