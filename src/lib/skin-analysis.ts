import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import {
  createPendingAnalysis,
  markAnalysisFailed,
  markAnalysisProcessing,
  markAnalysisSucceeded,
  getLatestSucceededAnalysis,
} from "@/db/queries/skin-analysis";
import { analyzeImage, mapConcernsToTrackedMetrics, type ParsedConcern } from "@/lib/youcam";
import {
  YouCamError,
  YouCamInputError,
  YouCamRateLimitError,
  YouCamTaskFailedError,
  YouCamTimeoutError,
  describeInputError,
  isInputErrorCode,
} from "@/lib/youcam/errors";
import { captureServerEvent } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { getSkinAgeInsight } from "@/lib/insights";

/** Maps any thrown error to a stored (code, user-facing message) pair. */
function describeFailure(err: unknown): { code: string; message: string } {
  if (err instanceof YouCamInputError) {
    return { code: err.code, message: describeInputError(err.code) };
  }
  if (err instanceof YouCamRateLimitError) {
    return {
      code: "rate_limited",
      message: "Analysis is temporarily busy — we'll retry shortly.",
    };
  }
  if (err instanceof YouCamTaskFailedError) {
    // Some task-level failures (bad resolution, face too small, ...) are
    // really input problems surfaced asynchronously — give them the same
    // friendly, actionable copy as a synchronous input rejection.
    if (err.code && isInputErrorCode(err.code)) {
      return { code: err.code, message: describeInputError(err.code) };
    }
    return {
      code: err.code ?? "task_failed",
      message: "The analysis couldn't be completed for that photo. Try a different one.",
    };
  }
  if (err instanceof YouCamTimeoutError) {
    return { code: "timeout", message: "Analysis is taking longer than expected. Try again shortly." };
  }
  if (err instanceof YouCamError) {
    return { code: "youcam_error", message: "Analysis failed. Try again shortly." };
  }
  return { code: "unknown", message: "Something went wrong analyzing that photo." };
}

/**
 * YouCam's mask images are presigned S3 URLs that expire in 2 hours — dead
 * links well before anyone revisits their results page. Mirrors each one
 * into our own R2 bucket and swaps `maskUrl` to point at that key instead.
 * A mask that fails to copy is dropped (set to undefined) rather than
 * failing the analysis — the numeric score is still valid without it.
 */
async function persistConcernMasks(
  env: CloudflareEnv,
  params: { userId: string; scanId: string; concerns: ParsedConcern[] },
): Promise<ParsedConcern[]> {
  return Promise.all(
    params.concerns.map(async (c): Promise<ParsedConcern> => {
      if (!c.maskUrl) return c;
      try {
        const res = await fetch(c.maskUrl);
        if (!res.ok) return { ...c, maskUrl: undefined };
        const r2Key = `scans/${params.userId}/${params.scanId}/masks/${c.concern}.png`;
        await env.PHOTOS_BUCKET.put(r2Key, await res.arrayBuffer(), {
          httpMetadata: { contentType: "image/png" },
        });
        return { ...c, maskUrl: r2Key };
      } catch {
        return { ...c, maskUrl: undefined };
      }
    }),
  );
}

/**
 * Runs a full skin analysis for one scan photo: R2 fetch -> YouCam upload
 * -> task creation -> poll to completion -> transform -> persist. Intended
 * to be invoked via `ctx.waitUntil` from a server action so the check-in
 * flow doesn't block on a ~10-30s vendor round trip; the client instead
 * polls `getAnalysisForScan` for status.
 *
 * Scaling note: this runs the vendor poll loop inline inside the Worker's
 * `waitUntil` budget, which is fine at low-to-moderate volume. If check-in
 * volume grows enough for that to matter, move this to a Cloudflare Queue
 * consumer instead — same persistence functions, different trigger.
 */
export async function runSkinAnalysisForScan(params: {
  userId: string;
  scanId: string;
  r2Key: string;
}): Promise<void> {
  const db = getDb();
  const { env } = getCloudflareContext();

  const analysis = await createPendingAnalysis(db, {
    scanId: params.scanId,
    userId: params.userId,
  });

  captureServerEvent({
    distinctId: params.userId,
    event: ANALYTICS_EVENTS.AI_ANALYSIS_REQUESTED,
    properties: { scanId: params.scanId },
  });

  try {
    const object = await env.PHOTOS_BUCKET.get(params.r2Key);
    if (!object) throw new YouCamError(`Photo not found in R2: ${params.r2Key}`);
    const bytes = await object.arrayBuffer();
    const contentType = object.httpMetadata?.contentType ?? "image/jpeg";

    await markAnalysisProcessing(db, analysis.id, {});

    // Fetched before this analysis is marked succeeded, so it naturally
    // excludes the in-flight one — see getLatestSucceededAnalysis's doc.
    const previous = await getLatestSucceededAnalysis(db, params.userId);

    const result = await analyzeImage({
      bytes,
      contentType,
      fileName: params.r2Key.split("/").pop() ?? "scan.jpg",
    });

    const concerns = await persistConcernMasks(env, {
      userId: params.userId,
      scanId: params.scanId,
      concerns: result.concerns,
    });
    const trackedMetrics = mapConcernsToTrackedMetrics(concerns);

    await markAnalysisSucceeded(db, analysis.id, {
      scanId: params.scanId,
      userId: params.userId,
      skinAge: result.skinAge,
      providerOverallScore: result.providerOverallScore,
      providerFileId: result.providerFileId,
      providerTaskId: result.providerTaskId,
      rawResult: result.rawResult,
      concerns,
      trackedMetrics,
    });

    const skinAgeInsight =
      result.skinAge !== null ? getSkinAgeInsight(result.skinAge, previous?.skinAge ?? null) : null;

    captureServerEvent({
      distinctId: params.userId,
      event: ANALYTICS_EVENTS.AI_ANALYSIS_COMPLETED,
      properties: {
        scanId: params.scanId,
        skinAge: result.skinAge,
        skinAgeDelta: skinAgeInsight?.deltaFromPrevious ?? null,
        concernCount: result.concerns.length,
        trackedMetricCount: Object.keys(trackedMetrics).length,
      },
    });
  } catch (err) {
    const { code, message } = describeFailure(err);
    // `waitUntil` failures don't surface anywhere else — this is the only
    // place the real cause behind a generic stored error is visible.
    console.error(`[skin-analysis] scan ${params.scanId} failed (${code}):`, err);
    await markAnalysisFailed(db, analysis.id, { errorCode: code, errorMessage: message });
    captureServerEvent({
      distinctId: params.userId,
      event: ANALYTICS_EVENTS.AI_ANALYSIS_FAILED,
      properties: { scanId: params.scanId, errorCode: code },
    });
  }
}

/** Fire-and-forget entry point for callers already inside a request (server actions, routes). */
export function requestSkinAnalysis(params: { userId: string; scanId: string; r2Key: string }): void {
  const { ctx } = getCloudflareContext();
  ctx.waitUntil(runSkinAnalysisForScan(params));
}
