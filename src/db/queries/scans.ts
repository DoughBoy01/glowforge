import { and, count, desc, eq, inArray, lt } from "drizzle-orm";
import type { Database } from "@/db";
import { scans, scanPhotos, metricScores, skinConcernScores } from "@/db/schema";
import {
  TRACKED_METRICS,
  computeOverallScore,
  type MetricType,
  type TrackedMetric,
} from "@/lib/metrics";

export type NewScanInput = {
  id?: string;
  userId: string;
  notes?: string | null;
  /**
   * Partial on purpose — the selfie-first check-in flow doesn't require
   * manual scores at all (AI analysis fills `metricScores` in once it
   * completes). Only write rows for metrics actually provided rather than
   * defaulting missing ones, so a photo-only scan doesn't end up with fake
   * "50" scores masquerading as real data.
   */
  scores: Partial<Record<TrackedMetric, number>>;
  photos?: { angle: "front" | "left" | "right" | "eyes_close"; r2Key: string }[];
};

export async function createScan(db: Database, input: NewScanInput) {
  const [scan] = await db
    .insert(scans)
    .values({
      ...(input.id ? { id: input.id } : {}),
      userId: input.userId,
      notes: input.notes ?? null,
    })
    .returning();

  const providedMetrics = TRACKED_METRICS.filter((m) => input.scores[m] !== undefined);
  let overall: number | null = null;

  if (providedMetrics.length) {
    const rows: { scanId: string; userId: string; metricType: MetricType; score: number }[] =
      providedMetrics.map((metricType) => ({
        scanId: scan.id,
        userId: input.userId,
        metricType,
        score: input.scores[metricType]!,
      }));

    if (providedMetrics.length === TRACKED_METRICS.length) {
      overall = computeOverallScore(input.scores as Record<TrackedMetric, number>);
      rows.push({
        scanId: scan.id,
        userId: input.userId,
        metricType: "overall" as const,
        score: overall,
      });
    }

    await db.insert(metricScores).values(rows);
  }

  if (input.photos?.length) {
    await db.insert(scanPhotos).values(
      input.photos.map((p) => ({
        scanId: scan.id,
        userId: input.userId,
        angle: p.angle,
        r2Key: p.r2Key,
      })),
    );
  }

  return { scan, overall };
}

export async function getRecentScans(db: Database, userId: string, limit = 30) {
  return db.query.scans.findMany({
    where: eq(scans.userId, userId),
    orderBy: [desc(scans.capturedAt)],
    limit,
    with: { metricScores: true, photos: true, analysis: true },
  });
}

/** Includes the per-concern rows, since the generated routine reads radiance out of them. */
export async function getLatestScan(db: Database, userId: string) {
  return db.query.scans.findFirst({
    where: eq(scans.userId, userId),
    orderBy: [desc(scans.capturedAt)],
    with: { metricScores: true, analysis: { with: { concernScores: true } } },
  });
}

/**
 * Every check-in, newest first — the backing query for the progress page.
 * Unlike `getRecentScans` (which the dashboard calls with limit 2 to get
 * "latest + previous"), this is paged so the full archive stays reachable
 * rather than only the most recent result.
 */
export async function getScanHistory(
  db: Database,
  userId: string,
  { limit = 60, offset = 0 }: { limit?: number; offset?: number } = {},
) {
  return db.query.scans.findMany({
    where: eq(scans.userId, userId),
    orderBy: [desc(scans.capturedAt)],
    limit,
    offset,
    with: { metricScores: true, photos: true, analysis: true },
  });
}

/** Total check-ins ever logged — drives paging and the "N check-ins" headline. */
export async function countScans(db: Database, userId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(scans)
    .where(eq(scans.userId, userId));
  return row?.value ?? 0;
}

/**
 * Raw per-concern scores for a specific set of scans, for concern-level
 * trend lines. Takes scan ids rather than a date range because D1 caps a
 * statement at 100 bound parameters — the caller passes the page of scans
 * it already loaded, so the count is bounded by the page size.
 */
export async function getConcernScoresForScans(
  db: Database,
  userId: string,
  scanIds: string[],
) {
  if (!scanIds.length) return [];
  return db.query.skinConcernScores.findMany({
    where: and(
      eq(skinConcernScores.userId, userId),
      inArray(skinConcernScores.scanId, scanIds),
    ),
  });
}

/**
 * Chronological (oldest → newest) score history for one metric, for
 * charting. Ordered by the scan's `capturedAt`, not the score row's
 * `createdAt`: an AI analysis upserts its scores minutes-to-hours after the
 * photo was taken, so insert order isn't capture order. Uses an explicit
 * join because drizzle's relational API can't order by a related table.
 */
export async function getMetricTrend(
  db: Database,
  userId: string,
  metricType: TrackedMetric | "overall",
  limit = 90,
) {
  const rows = await db
    .select({
      scanId: metricScores.scanId,
      score: metricScores.score,
      capturedAt: scans.capturedAt,
    })
    .from(metricScores)
    .innerJoin(scans, eq(metricScores.scanId, scans.id))
    .where(
      and(eq(metricScores.userId, userId), eq(metricScores.metricType, metricType)),
    )
    .orderBy(desc(scans.capturedAt))
    .limit(limit);
  return rows.reverse();
}

/** Full scan detail for the results page — includes photos and the AI analysis (with its raw concern scores) alongside the metric rollup. */
export async function getScanById(db: Database, userId: string, scanId: string) {
  return db.query.scans.findFirst({
    where: and(eq(scans.id, scanId), eq(scans.userId, userId)),
    with: {
      metricScores: true,
      photos: true,
      analysis: { with: { concernScores: true } },
    },
  });
}

/** The scan immediately before a given one, for scan-over-scan deltas on the results page. */
export async function getPreviousScan(db: Database, userId: string, beforeCapturedAt: Date) {
  return db.query.scans.findFirst({
    where: and(eq(scans.userId, userId), lt(scans.capturedAt, beforeCapturedAt)),
    orderBy: [desc(scans.capturedAt)],
    with: { metricScores: true, analysis: true },
  });
}
