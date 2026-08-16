import { sql, eq, and } from "drizzle-orm";
import type { Database } from "@/db";
import { skinPredictions } from "@/db/schema";

export type PredictionStatus = "pending" | "processing" | "succeeded" | "failed" | "skipped";

/**
 * Creates (or resets, on retry) the prediction row for a scan. Same upsert
 * shape as `createPendingAnalysis`/`createPendingSimulation` — one prediction
 * per scan, keyed off the unique `scanId` index.
 */
export async function createPendingPrediction(
  db: Database,
  params: { scanId: string; userId: string },
) {
  const [row] = await db
    .insert(skinPredictions)
    .values({ scanId: params.scanId, userId: params.userId, status: "pending" })
    .onConflictDoUpdate({
      target: skinPredictions.scanId,
      set: {
        status: "pending",
        predictedSkinAge: null,
        predictedOverallScore: null,
        providerFileId: null,
        providerTaskId: null,
        rawResult: null,
        errorCode: null,
        errorMessage: null,
        completedAt: null,
        requestedAt: sql`(unixepoch())`,
      },
    })
    .returning();
  return row;
}

export async function markPredictionProcessing(
  db: Database,
  predictionId: string,
  params: { providerFileId?: string; providerTaskId?: string },
) {
  await db
    .update(skinPredictions)
    .set({
      status: "processing",
      providerFileId: params.providerFileId,
      providerTaskId: params.providerTaskId,
    })
    .where(eq(skinPredictions.id, predictionId));
}

export async function markPredictionSucceeded(
  db: Database,
  predictionId: string,
  params: {
    predictedSkinAge: number | null;
    predictedOverallScore: number | null;
    providerFileId: string;
    providerTaskId: string;
    rawResult: unknown;
  },
) {
  await db
    .update(skinPredictions)
    .set({
      status: "succeeded",
      predictedSkinAge: params.predictedSkinAge,
      predictedOverallScore: params.predictedOverallScore,
      providerFileId: params.providerFileId,
      providerTaskId: params.providerTaskId,
      rawResult: JSON.stringify(params.rawResult),
      completedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    })
    .where(eq(skinPredictions.id, predictionId));
}

export async function markPredictionFailed(
  db: Database,
  predictionId: string,
  params: { errorCode: string; errorMessage: string },
) {
  await db
    .update(skinPredictions)
    .set({
      status: "failed",
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      completedAt: new Date(),
    })
    .where(eq(skinPredictions.id, predictionId));
}

/**
 * Terminal state for "no goal image to grade" — the simulation step itself
 * skipped or failed, so there's nothing for this step to analyze. Distinct
 * from `failed`: nothing went wrong here, there was just no input.
 */
export async function markPredictionSkipped(db: Database, predictionId: string, reason: string) {
  await db
    .update(skinPredictions)
    .set({ status: "skipped", errorMessage: reason, completedAt: new Date() })
    .where(eq(skinPredictions.id, predictionId));
}

export async function getPredictionForScan(db: Database, userId: string, scanId: string) {
  return db.query.skinPredictions.findFirst({
    where: and(eq(skinPredictions.scanId, scanId), eq(skinPredictions.userId, userId)),
  });
}
