import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import {
  createPendingSimulation,
  markSimulationFailed,
  markSimulationProcessing,
  markSimulationSkipped,
  markSimulationSucceeded,
} from "@/db/queries/skin-simulations";
import { simulateImage } from "@/lib/youcam";
import { YouCamError } from "@/lib/youcam/errors";
import {
  deriveSimulationParams,
  defaultGoalFor,
  type SimulationGoal,
} from "@/lib/face-simulation";
import { getCategoryPriorities } from "@/lib/insights";
import { captureServerEvent } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import type { TrackedMetric } from "@/lib/metrics";
import { TRACKED_METRICS } from "@/lib/metrics";

/**
 * Renders the goal image for a scan: measured concern scores -> derived
 * simulation intensities -> YouCam skin simulation -> R2.
 *
 * Runs *after* a successful analysis, chained from the same background job —
 * it can't run before, because the intensities are derived from the analysis
 * output. Failure here is deliberately non-fatal: the scan, the scores and
 * the projection are all still valid without a picture, so this records its
 * own failure and returns rather than propagating.
 *
 * Cost note: this is a second billed vendor call on every check-in that
 * produces analysable concern scores. If that becomes the wrong trade, the
 * cheapest lever is to gate the call on `users.plan === "pro"` at the call
 * site in `skin-analysis.ts` — nothing in this module assumes it runs for
 * everyone.
 */
export async function runGoalSimulationForScan(params: {
  userId: string;
  scanId: string;
  r2Key: string;
  concernScores: { concern: string; uiScore: number }[];
  trackedMetrics: Partial<Record<TrackedMetric, number>>;
  /** Overrides the derived default (the user's weakest category). */
  goal?: SimulationGoal;
}): Promise<void> {
  const db = getDb();
  const { env } = getCloudflareContext();

  // Priorities need the full set of four; a partial analysis falls back to an
  // overall goal rather than ranking against metrics it doesn't have.
  const complete = TRACKED_METRICS.every((m) => params.trackedMetrics[m] != null);
  const goal =
    params.goal ??
    (complete
      ? defaultGoalFor(
          getCategoryPriorities(params.trackedMetrics as Record<TrackedMetric, number>),
        )
      : defaultGoalFor([]));

  const simulation = await createPendingSimulation(db, {
    scanId: params.scanId,
    userId: params.userId,
    goal,
  });

  const derived = deriveSimulationParams(params.concernScores, goal);

  // Skin with no meaningful headroom. Calling the vendor here would spend a
  // credit to render an image identical to the input — and then show the user
  // a "before and after" with no after.
  if (!derived.isViable) {
    await markSimulationSkipped(
      db,
      simulation.id,
      "Your scores are already high enough that a simulation wouldn't show a visible change.",
    );
    return;
  }

  try {
    const object = await env.PHOTOS_BUCKET.get(params.r2Key);
    if (!object) throw new YouCamError(`Photo not found in R2: ${params.r2Key}`);
    const bytes = await object.arrayBuffer();
    const contentType = object.httpMetadata?.contentType ?? "image/jpeg";

    await markSimulationProcessing(db, simulation.id, { intensities: derived.intensities });

    const result = await simulateImage({
      bytes,
      contentType,
      fileName: params.r2Key.split("/").pop() ?? "scan.jpg",
      intensities: derived.intensities,
    });

    const r2Key = `scans/${params.userId}/${params.scanId}/simulation.jpg`;
    await env.PHOTOS_BUCKET.put(r2Key, result.bytes, {
      httpMetadata: { contentType: result.contentType },
    });

    await markSimulationProcessing(db, simulation.id, {
      intensities: derived.intensities,
      providerFileId: result.providerFileId,
      providerTaskId: result.providerTaskId,
    });
    await markSimulationSucceeded(db, simulation.id, {
      r2Key,
      providerTaskId: result.providerTaskId,
    });

    captureServerEvent({
      distinctId: params.userId,
      event: ANALYTICS_EVENTS.GOAL_SIMULATION_COMPLETED,
      properties: {
        scanId: params.scanId,
        goalFocus: goal.focus,
        horizonWeeks: goal.horizonWeeks,
        paramCount: derived.params.length,
        totalIntensity: derived.params.reduce((sum, p) => sum + p.intensity, 0),
      },
    });
  } catch (err) {
    // Same reasoning as the analysis job: `waitUntil` failures are invisible
    // otherwise, and the stored message is deliberately generic.
    console.error(`[goal-simulation] scan ${params.scanId} failed:`, err);
    await markSimulationFailed(db, simulation.id, {
      errorCode: err instanceof YouCamError ? "youcam_error" : "unknown",
      errorMessage: "We couldn't generate your goal preview for this scan.",
    });
    captureServerEvent({
      distinctId: params.userId,
      event: ANALYTICS_EVENTS.GOAL_SIMULATION_FAILED,
      properties: { scanId: params.scanId, goalFocus: goal.focus },
    });
  }
}
