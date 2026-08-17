import { sql, eq, and } from "drizzle-orm";
import type { Database } from "@/db";
import { skinSimulations } from "@/db/schema";
import type { SimulationParam } from "@/lib/youcam/constants";
import type { SimulationGoal } from "@/lib/face-simulation";

export type SimulationStatus = "pending" | "processing" | "succeeded" | "failed" | "skipped";

/**
 * Creates (or resets, on retry) the simulation row for a scan. Same upsert
 * shape as `createPendingAnalysis` — one simulation per scan, and a re-run
 * resets the existing row rather than accumulating history. Re-running is the
 * expected path when tuning the intensity model: the goal image is a derived
 * artifact, not a record of anything.
 */
export async function createPendingSimulation(
  db: Database,
  params: { scanId: string; userId: string; goal: SimulationGoal },
) {
  const [row] = await db
    .insert(skinSimulations)
    .values({
      scanId: params.scanId,
      userId: params.userId,
      status: "pending",
      goalFocus: params.goal.focus,
      goalHorizonWeeks: params.goal.horizonWeeks,
    })
    .onConflictDoUpdate({
      target: skinSimulations.scanId,
      set: {
        status: "pending",
        goalFocus: params.goal.focus,
        goalHorizonWeeks: params.goal.horizonWeeks,
        params: null,
        r2Key: null,
        errorCode: null,
        errorMessage: null,
        completedAt: null,
        requestedAt: sql`(unixepoch())`,
      },
    })
    .returning();
  return row;
}

export async function markSimulationProcessing(
  db: Database,
  simulationId: string,
  params: {
    intensities: Partial<Record<SimulationParam, number>>;
    providerFileId?: string;
    providerTaskId?: string;
  },
) {
  await db
    .update(skinSimulations)
    .set({
      status: "processing",
      params: JSON.stringify(params.intensities),
      providerFileId: params.providerFileId,
      providerTaskId: params.providerTaskId,
    })
    .where(eq(skinSimulations.id, simulationId));
}

export async function markSimulationSucceeded(
  db: Database,
  simulationId: string,
  params: { r2Key: string; providerTaskId?: string },
) {
  await db
    .update(skinSimulations)
    .set({
      status: "succeeded",
      r2Key: params.r2Key,
      providerTaskId: params.providerTaskId,
      completedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    })
    .where(eq(skinSimulations.id, simulationId));
}

export async function markSimulationFailed(
  db: Database,
  simulationId: string,
  params: { errorCode: string; errorMessage: string },
) {
  await db
    .update(skinSimulations)
    .set({
      status: "failed",
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      completedAt: new Date(),
    })
    .where(eq(skinSimulations.id, simulationId));
}

/**
 * Terminal state for skin with no meaningful headroom — distinct from
 * `failed` because nothing went wrong. The results page reads it as "your
 * scores are already high enough that there's nothing worth drawing", which
 * is a compliment, not an error.
 */
export async function markSimulationSkipped(
  db: Database,
  simulationId: string,
  reason: string,
) {
  await db
    .update(skinSimulations)
    .set({ status: "skipped", errorMessage: reason, completedAt: new Date() })
    .where(eq(skinSimulations.id, simulationId));
}

export async function getSimulationForScan(db: Database, userId: string, scanId: string) {
  return db.query.skinSimulations.findFirst({
    where: and(eq(skinSimulations.scanId, scanId), eq(skinSimulations.userId, userId)),
  });
}
