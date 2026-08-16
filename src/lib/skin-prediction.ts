import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import {
  createPendingPrediction,
  markPredictionProcessing,
  markPredictionSucceeded,
  markPredictionFailed,
  markPredictionSkipped,
} from "@/db/queries/skin-predictions";
import { getSimulationForScan } from "@/db/queries/skin-simulations";
import { analyzeImage } from "@/lib/youcam";
import { YouCamError, describeFailure } from "@/lib/youcam/errors";
import { captureServerEvent } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

/**
 * Closes the loop: re-runs the same YouCam skin-analysis call used on real
 * photos, but on the goal image `runGoalSimulationForScan` just generated —
 * the vendor's own analysis grading the vendor's own generation, rather than
 * a picture nobody ever checks against anything.
 *
 * Must never throw. It runs *after* the real analysis has already been
 * marked succeeded (see `runSkinAnalysisForScan`), so a failure here has to
 * stay contained to this step's own row — it can't be allowed to retroactively
 * flip an already-successful real analysis to failed.
 */
export async function runPredictionForScan(params: {
  userId: string;
  scanId: string;
}): Promise<void> {
  const db = getDb();
  const { env } = getCloudflareContext();

  const simulation = await getSimulationForScan(db, params.userId, params.scanId);
  if (!simulation || simulation.status !== "succeeded" || !simulation.r2Key) {
    const prediction = await createPendingPrediction(db, {
      scanId: params.scanId,
      userId: params.userId,
    });
    await markPredictionSkipped(db, prediction.id, "No simulated goal image to analyze.");
    return;
  }

  const prediction = await createPendingPrediction(db, {
    scanId: params.scanId,
    userId: params.userId,
  });

  try {
    const object = await env.PHOTOS_BUCKET.get(simulation.r2Key);
    if (!object) throw new YouCamError(`Simulation image not found in R2: ${simulation.r2Key}`);
    const bytes = await object.arrayBuffer();
    const contentType = object.httpMetadata?.contentType ?? "image/jpeg";

    await markPredictionProcessing(db, prediction.id, {});

    const result = await analyzeImage({ bytes, contentType, fileName: "simulation.jpg" });

    await markPredictionSucceeded(db, prediction.id, {
      predictedSkinAge: result.skinAge,
      predictedOverallScore: result.providerOverallScore,
      providerFileId: result.providerFileId,
      providerTaskId: result.providerTaskId,
      rawResult: result.rawResult,
    });

    captureServerEvent({
      distinctId: params.userId,
      event: ANALYTICS_EVENTS.PREDICTION_COMPLETED,
      properties: { scanId: params.scanId, predictedSkinAge: result.skinAge },
    });
  } catch (err) {
    const { code, message } = describeFailure(err);
    console.error(`[skin-prediction] scan ${params.scanId} failed (${code}):`, err);
    await markPredictionFailed(db, prediction.id, { errorCode: code, errorMessage: message });
    captureServerEvent({
      distinctId: params.userId,
      event: ANALYTICS_EVENTS.PREDICTION_FAILED,
      properties: { scanId: params.scanId, errorCode: code },
    });
  }
}
