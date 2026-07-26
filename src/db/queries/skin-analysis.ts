import { sql, eq, and, desc } from "drizzle-orm";
import type { Database } from "@/db";
import { skinAnalyses, skinConcernScores, metricScores } from "@/db/schema";
import { TRACKED_METRICS, computeOverallScore, type TrackedMetric } from "@/lib/metrics";
import type { ParsedConcern } from "@/lib/youcam/transform";
import type { YouCamConcern } from "@/lib/youcam/types";
import { SD_CONCERNS } from "@/lib/youcam/constants";

const KNOWN_CONCERNS = new Set<string>(SD_CONCERNS);

// D1 caps bound parameters at 100 per statement. Each concern row binds 8
// columns, so a single insert can't hold more than ~12 rows — well under
// the up to 16 concerns SD-tier analysis can return — so batch instead.
const CONCERN_INSERT_BATCH_SIZE = 10;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

/**
 * Creates (or resets, on retry) the pending analysis row for a scan. Uses
 * the unique index on `scanId` to upsert — a scan only ever has one
 * analysis, and re-requesting after a failure should reset its state
 * rather than error on a duplicate key.
 */
export async function createPendingAnalysis(
  db: Database,
  params: { scanId: string; userId: string },
) {
  const [row] = await db
    .insert(skinAnalyses)
    .values({ scanId: params.scanId, userId: params.userId, status: "pending" })
    .onConflictDoUpdate({
      target: skinAnalyses.scanId,
      set: {
        status: "pending",
        errorCode: null,
        errorMessage: null,
        completedAt: null,
        requestedAt: sql`(unixepoch())`,
      },
    })
    .returning();
  return row;
}

export async function markAnalysisProcessing(
  db: Database,
  analysisId: string,
  params: { providerFileId?: string; providerTaskId?: string },
) {
  await db
    .update(skinAnalyses)
    .set({
      status: "processing",
      providerFileId: params.providerFileId,
      providerTaskId: params.providerTaskId,
    })
    .where(eq(skinAnalyses.id, analysisId));
}

export interface AnalysisSuccessInput {
  scanId: string;
  userId: string;
  skinAge: number | null;
  providerOverallScore: number | null;
  providerFileId: string;
  providerTaskId: string;
  rawResult: unknown;
  concerns: ParsedConcern[];
  trackedMetrics: Partial<Record<TrackedMetric, number>>;
}

/**
 * Persists a completed analysis: updates the analysis row, upserts raw
 * per-concern scores, and upserts the curated tracked-metric rollup (plus
 * `overall`, only when every tracked metric could be derived). All three
 * writes key off the scan, so re-running an analysis for the same scan
 * (retry, or a future re-processing pass) overwrites in place instead of
 * accumulating duplicate rows.
 */
export async function markAnalysisSucceeded(db: Database, analysisId: string, params: AnalysisSuccessInput) {
  await db
    .update(skinAnalyses)
    .set({
      status: "succeeded",
      skinAge: params.skinAge,
      providerOverallScore: params.providerOverallScore,
      providerFileId: params.providerFileId,
      providerTaskId: params.providerTaskId,
      rawResult: JSON.stringify(params.rawResult),
      completedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    })
    .where(eq(skinAnalyses.id, analysisId));

  const knownConcerns = params.concerns.filter((c) => KNOWN_CONCERNS.has(c.concern));
  for (const batch of chunk(knownConcerns, CONCERN_INSERT_BATCH_SIZE)) {
    await db
      .insert(skinConcernScores)
      .values(
        batch.map((c) => ({
          analysisId,
          scanId: params.scanId,
          userId: params.userId,
          concern: c.concern as YouCamConcern,
          rawScore: c.rawScore,
          uiScore: c.uiScore,
          maskUrl: c.maskUrl ?? null,
        })),
      )
      .onConflictDoUpdate({
        target: [skinConcernScores.scanId, skinConcernScores.concern],
        set: {
          rawScore: sql`excluded.raw_score`,
          uiScore: sql`excluded.ui_score`,
          maskUrl: sql`excluded.mask_url`,
          analysisId: sql`excluded.analysis_id`,
        },
      });
  }

  const trackedEntries = Object.entries(params.trackedMetrics) as [TrackedMetric, number][];
  if (trackedEntries.length) {
    const rows: {
      scanId: string;
      userId: string;
      metricType: TrackedMetric | "overall";
      score: number;
      source: "ai_analysis";
    }[] = trackedEntries.map(([metricType, score]) => ({
      scanId: params.scanId,
      userId: params.userId,
      metricType,
      score,
      source: "ai_analysis",
    }));

    if (trackedEntries.length === TRACKED_METRICS.length) {
      const scores = Object.fromEntries(trackedEntries) as Record<TrackedMetric, number>;
      rows.push({
        scanId: params.scanId,
        userId: params.userId,
        metricType: "overall",
        score: computeOverallScore(scores),
        source: "ai_analysis",
      });
    }

    await db
      .insert(metricScores)
      .values(rows)
      .onConflictDoUpdate({
        target: [metricScores.scanId, metricScores.metricType],
        set: {
          score: sql`excluded.score`,
          source: sql`excluded.source`,
        },
      });
  }
}

export async function markAnalysisFailed(
  db: Database,
  analysisId: string,
  params: { errorCode: string; errorMessage: string },
) {
  await db
    .update(skinAnalyses)
    .set({
      status: "failed",
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      completedAt: new Date(),
    })
    .where(eq(skinAnalyses.id, analysisId));
}

export async function getAnalysisForScan(db: Database, userId: string, scanId: string) {
  return db.query.skinAnalyses.findFirst({
    where: and(eq(skinAnalyses.scanId, scanId), eq(skinAnalyses.userId, userId)),
    with: { concernScores: true },
  });
}

/**
 * Most recent *successful* analysis for a user, used to compute the skin
 * age delta. Call this before marking the current scan's analysis
 * succeeded — while it's still pending/processing, this query naturally
 * excludes it without needing to filter by scan id.
 */
export async function getLatestSucceededAnalysis(db: Database, userId: string) {
  return db.query.skinAnalyses.findFirst({
    where: and(eq(skinAnalyses.userId, userId), eq(skinAnalyses.status, "succeeded")),
    orderBy: [desc(skinAnalyses.completedAt)],
  });
}
