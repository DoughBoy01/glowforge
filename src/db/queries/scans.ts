import { and, count, desc, eq, inArray, isNotNull, lt } from "drizzle-orm";
import type { Database } from "@/db";
import { scans, scanPhotos, metricScores, skinAnalyses, skinConcernScores } from "@/db/schema";
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

/**
 * Recent scans for the home screen's sparklines and deltas.
 *
 * No `photos` relation, deliberately: the home screen doesn't render any, and
 * pulling a dozen scans' worth of photo rows over D1 to throw them away is pure
 * latency on the first paint of the app's most-visited page. `getScanHistory`
 * and `getScanById` include them, for the screens that actually show them.
 */
export async function getRecentScans(db: Database, userId: string, limit = 30) {
  return db.query.scans.findMany({
    where: eq(scans.userId, userId),
    orderBy: [desc(scans.capturedAt)],
    limit,
    with: { metricScores: true, analysis: true },
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

/**
 * Every face age the user has on record, oldest first — the backing query for
 * the mission readout on the home screen.
 *
 * Deliberately its own query rather than something derived from the scan blobs
 * a page already loaded, for two reasons. It has to be the *complete* history,
 * because the baseline is what the mission is scored against and the dashboard
 * only ever loads a dozen recent scans — deriving the baseline from those would
 * redefine "where you started" every time someone checked in. And it's three
 * columns off an indexed status filter, so asking for all of it costs less than
 * the twelve-scan relational fetch it replaces the need for.
 */
export async function getFaceAgeReadings(db: Database, userId: string) {
  const rows = await db
    .select({
      scanId: scans.id,
      capturedAt: scans.capturedAt,
      faceAge: skinAnalyses.skinAge,
    })
    .from(skinAnalyses)
    .innerJoin(scans, eq(skinAnalyses.scanId, scans.id))
    .where(
      and(
        eq(skinAnalyses.userId, userId),
        eq(skinAnalyses.status, "succeeded"),
        isNotNull(skinAnalyses.skinAge),
      ),
    )
    .orderBy(scans.capturedAt);

  // `isNotNull` already excludes the nulls; the filter is here to convince the
  // type checker, since drizzle types the column as nullable regardless.
  return rows.flatMap((row) =>
    row.faceAge === null ? [] : [{ ...row, faceAge: row.faceAge }],
  );
}

/**
 * The two things a goal-image panel needs for a scan that `getRecentScans`
 * doesn't already carry: whether it has a front photo, and its raw concern
 * scores (to re-derive the simulation's labels and focus flags — see
 * `resolveGoalPreview`). Split out rather than added to `getRecentScans`'s
 * `with` clause, which deliberately excludes photos across the dozen scans
 * that feeds the dashboard's sparklines — this is one scan, not twelve.
 */
export async function getScanGoalContext(db: Database, userId: string, scanId: string) {
  const [photo, concernScores] = await Promise.all([
    db.query.scanPhotos.findFirst({
      where: and(
        eq(scanPhotos.scanId, scanId),
        eq(scanPhotos.userId, userId),
        eq(scanPhotos.angle, "front"),
      ),
    }),
    db.query.skinConcernScores.findMany({
      where: and(eq(skinConcernScores.scanId, scanId), eq(skinConcernScores.userId, userId)),
    }),
  ]);
  return { hasFrontPhoto: !!photo, concernScores };
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
    // `prediction` rides along so the results page can reconcile this scan's
    // real measurement against the previous check-in's goal-image projection
    // without a second query — see `getPredictionForScan` for the standalone
    // fetch if a caller ever needs just this.
    with: { metricScores: true, analysis: true, prediction: true },
  });
}
