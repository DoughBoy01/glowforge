import {
  TRACKED_METRICS,
  METRIC_META,
  OVERALL_META,
  scoreForMetric,
  type MetricType,
  type TrackedMetric,
} from "@/lib/metrics";
import { CONCERN_META } from "@/lib/concerns";
import type { YouCamConcern } from "@/lib/youcam/types";

/**
 * Pure shaping of scan history into the series the progress page charts.
 * Kept out of the page and the DB layer so the "what does progress look
 * like" rules live in one place — the dashboard, progress page, compare
 * view, and share cards all read deltas the same way.
 *
 * Every series here is keyed on `scan.capturedAt`, not on the score row's
 * `createdAt`: an AI analysis upserts metric rows minutes-to-hours after
 * the photo was taken, and a retro-analysis of an old scan would otherwise
 * plot itself as "today" and scramble the chronology.
 */

export interface TrendPoint {
  scanId: string;
  date: Date;
  score: number;
}

/** The subset of a scan row this module needs — structurally compatible with `getScanHistory` results. */
export interface ScanHistoryEntry {
  id: string;
  capturedAt: Date;
  metricScores: { metricType: string; score: number }[];
  photos?: { angle: string }[];
  analysis?: { status: string; skinAge: number | null } | null;
}

/** Newest-first history (as returned by `getScanHistory`) → oldest-first, which is what charts want. */
export function toChronological<T extends { capturedAt: Date }>(history: T[]): T[] {
  return [...history].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
}

/**
 * One time series per metric. Scans missing a score for a metric are
 * skipped rather than zero-filled — a photo-only check-in whose analysis
 * is still in flight shouldn't draw a cliff down to 0 on the chart.
 */
export function buildMetricSeries(
  history: ScanHistoryEntry[],
): Record<MetricType, TrendPoint[]> {
  const chronological = toChronological(history);
  const series = {} as Record<MetricType, TrendPoint[]>;

  for (const metric of [...TRACKED_METRICS, "overall" as const]) {
    series[metric] = chronological.flatMap((scan) => {
      const score = scoreForMetric(scan.metricScores, metric);
      return score === null ? [] : [{ scanId: scan.id, date: scan.capturedAt, score }];
    });
  }

  return series;
}

/** Skin age over time — only succeeded analyses carry a value. */
export function buildSkinAgeSeries(history: ScanHistoryEntry[]): TrendPoint[] {
  return toChronological(history).flatMap((scan) =>
    scan.analysis?.status === "succeeded" && scan.analysis.skinAge != null
      ? [{ scanId: scan.id, date: scan.capturedAt, score: scan.analysis.skinAge }]
      : [],
  );
}

/** One row per check-in with every metric on it — the wide shape recharts wants for a multi-series chart. Missing scores stay `null` so lines gap instead of dropping to zero. */
export type MetricChartRow = { date: Date } & Record<MetricType, number | null>;

export function buildChartRows(history: ScanHistoryEntry[]): MetricChartRow[] {
  return toChronological(history).map((scan) => ({
    date: scan.capturedAt,
    ...(Object.fromEntries(
      [...TRACKED_METRICS, "overall" as const].map((m) => [
        m,
        scoreForMetric(scan.metricScores, m),
      ]),
    ) as Record<MetricType, number | null>),
  }));
}

export interface MetricProgress {
  metric: MetricType;
  label: string;
  chartVar: string;
  points: TrendPoint[];
  current: number | null;
  first: number | null;
  previous: number | null;
  /** Latest vs. the very first scored check-in. */
  allTimeDelta: number | null;
  /** Latest vs. the check-in immediately before it. */
  lastDelta: number | null;
  /** Latest vs. the earliest point inside the trailing window. */
  windowDelta: number | null;
  windowDays: number;
}

export function summarizeMetric(
  metric: MetricType,
  points: TrendPoint[],
  windowDays = 30,
): MetricProgress {
  const meta = metric === "overall" ? OVERALL_META : METRIC_META[metric];
  const current = points.at(-1) ?? null;
  const first = points[0] ?? null;
  const previous = points.length > 1 ? points[points.length - 2] : null;

  const cutoff = current ? current.date.getTime() - windowDays * 86_400_000 : 0;
  // First point at or after the cutoff. If that *is* the latest point, the
  // user has no earlier reading inside the window and there's no delta to
  // report — better than silently comparing a value against itself.
  const windowStart = current ? (points.find((p) => p.date.getTime() >= cutoff) ?? null) : null;

  return {
    metric,
    label: meta.label,
    chartVar: meta.chartVar,
    points,
    current: current?.score ?? null,
    first: first?.score ?? null,
    previous: previous?.score ?? null,
    allTimeDelta: current && first && first !== current ? current.score - first.score : null,
    lastDelta: current && previous ? current.score - previous.score : null,
    windowDelta:
      current && windowStart && windowStart !== current
        ? current.score - windowStart.score
        : null,
    windowDays,
  };
}

export interface ProgressSummary {
  totalScans: number;
  scoredScans: number;
  firstScanAt: Date | null;
  latestScanAt: Date | null;
  daysTracked: number;
  overall: MetricProgress;
  metrics: MetricProgress[];
  /** Tracked metric with the largest all-time gain, if any metric has moved up. */
  biggestGain: MetricProgress | null;
  /** Tracked metric with the largest all-time drop, if any metric has moved down. */
  biggestDrop: MetricProgress | null;
}

export function buildProgressSummary(
  history: ScanHistoryEntry[],
  totalScans: number,
  windowDays = 30,
): ProgressSummary {
  const chronological = toChronological(history);
  const series = buildMetricSeries(history);

  const overall = summarizeMetric("overall", series.overall, windowDays);
  const metrics = TRACKED_METRICS.map((m) => summarizeMetric(m, series[m], windowDays));

  const moved = metrics.filter((m) => m.allTimeDelta !== null);
  const gains = moved.filter((m) => m.allTimeDelta! > 0);
  const drops = moved.filter((m) => m.allTimeDelta! < 0);

  const firstScanAt = chronological[0]?.capturedAt ?? null;
  const latestScanAt = chronological.at(-1)?.capturedAt ?? null;

  return {
    totalScans,
    scoredScans: series.overall.length,
    firstScanAt,
    latestScanAt,
    daysTracked:
      firstScanAt && latestScanAt
        ? Math.max(
            0,
            Math.round((latestScanAt.getTime() - firstScanAt.getTime()) / 86_400_000),
          )
        : 0,
    overall,
    metrics,
    biggestGain: gains.length
      ? gains.reduce((best, m) => (m.allTimeDelta! > best.allTimeDelta! ? m : best))
      : null,
    biggestDrop: drops.length
      ? drops.reduce((worst, m) => (m.allTimeDelta! < worst.allTimeDelta! ? m : worst))
      : null,
  };
}

export interface ConcernTrend {
  concern: YouCamConcern;
  label: string;
  description: string;
  points: TrendPoint[];
  current: number;
  first: number;
  /** Latest vs. first reading — null until there are two analyzed scans. */
  allTimeDelta: number | null;
  lastDelta: number | null;
}

/**
 * Concern-level trends (the 14 raw vendor signals behind the four rolled-up
 * metrics), so a user working on one specific thing — acne, redness, pores —
 * can watch that line rather than inferring it from a composite.
 *
 * `rows` come from `getConcernScoresForScans`; `history` supplies the
 * capture timestamps, since concern rows only carry their own insert time.
 */
export function buildConcernTrends(
  rows: { concern: string; uiScore: number; scanId: string }[],
  history: ScanHistoryEntry[],
): ConcernTrend[] {
  const capturedAt = new Map(history.map((s) => [s.id, s.capturedAt]));
  const byConcern = new Map<string, TrendPoint[]>();

  for (const row of rows) {
    const date = capturedAt.get(row.scanId);
    if (!date) continue; // outside the loaded page of scans
    const points = byConcern.get(row.concern) ?? [];
    points.push({ scanId: row.scanId, date, score: row.uiScore });
    byConcern.set(row.concern, points);
  }

  return [...byConcern.entries()]
    .flatMap(([concern, unsorted]) => {
      const meta = CONCERN_META[concern as YouCamConcern];
      if (!meta) return []; // vendor added a concern we don't have copy for yet
      const points = [...unsorted].sort((a, b) => a.date.getTime() - b.date.getTime());
      const current = points.at(-1)!;
      const first = points[0];
      const previous = points.length > 1 ? points[points.length - 2] : null;

      return [
        {
          concern: concern as YouCamConcern,
          label: meta.label,
          description: meta.description,
          points,
          current: current.score,
          first: first.score,
          allTimeDelta: first === current ? null : current.score - first.score,
          lastDelta: previous ? current.score - previous.score : null,
        },
      ];
    })
    .sort((a, b) => a.current - b.current);
}

/** Scan-over-scan comparison of the four tracked metrics plus overall, for the compare view. */
export function compareScans(
  from: ScanHistoryEntry,
  to: ScanHistoryEntry,
): { metric: MetricType; label: string; from: number | null; to: number | null; delta: number | null }[] {
  return (["overall", ...TRACKED_METRICS] as MetricType[]).map((metric) => {
    const fromScore = scoreForMetric(from.metricScores, metric);
    const toScore = scoreForMetric(to.metricScores, metric);
    return {
      metric,
      label: metric === "overall" ? OVERALL_META.label : METRIC_META[metric as TrackedMetric].label,
      from: fromScore,
      to: toScore,
      delta: fromScore !== null && toScore !== null ? toScore - fromScore : null,
    };
  });
}

/** Concern-level diff between two scans, worst-first on the later scan. */
export function compareConcerns(
  rows: { concern: string; uiScore: number; scanId: string }[],
  fromScanId: string,
  toScanId: string,
) {
  const pick = (scanId: string) =>
    new Map(rows.filter((r) => r.scanId === scanId).map((r) => [r.concern, r.uiScore]));
  const fromScores = pick(fromScanId);
  const toScores = pick(toScanId);

  return [...new Set([...fromScores.keys(), ...toScores.keys()])]
    .flatMap((concern) => {
      const meta = CONCERN_META[concern as YouCamConcern];
      if (!meta) return [];
      const from = fromScores.get(concern) ?? null;
      const to = toScores.get(concern) ?? null;
      return [
        {
          concern: concern as YouCamConcern,
          label: meta.label,
          from,
          to,
          delta: from !== null && to !== null ? to - from : null,
        },
      ];
    })
    .sort((a, b) => (a.to ?? 101) - (b.to ?? 101));
}
