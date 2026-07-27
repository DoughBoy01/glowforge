import {
  concernsForQuality,
  YOUCAM_SIMULATION_TASK_ENDPOINT,
  type YouCamQuality,
  type SimulationParam,
} from "./constants";
import {
  createSkinAnalysisTask,
  createSkinSimulationTask,
  extractResultUrl,
  pollTaskUntilComplete,
  uploadImageForAnalysis,
  uploadImageForSimulation,
} from "./client";
import { YouCamError } from "./errors";
import { parseTaskResult, type ParsedAnalysisResult } from "./transform";

export * from "./errors";
export * from "./types";
export * from "./constants";
export {
  uploadImageForAnalysis,
  uploadImageForSimulation,
  createSkinAnalysisTask,
  createSkinSimulationTask,
  extractResultUrl,
  getTaskStatus,
  pollTaskUntilComplete,
} from "./client";
export {
  parseTaskResult,
  mapConcernsToTrackedMetrics,
  type ParsedConcern,
  type ParsedAnalysisResult,
} from "./transform";

export interface AnalyzeImageResult extends ParsedAnalysisResult {
  providerFileId: string;
  providerTaskId: string;
  rawResult: unknown;
}

/**
 * Vendor-only orchestration: upload -> create task -> poll -> parse. No
 * database access here — this module is a pure YouCam client; persistence
 * lives in `src/db/queries/skin-analysis.ts` so this stays reusable (and
 * testable) outside of Drizzle/D1.
 */
export async function analyzeImage(params: {
  bytes: ArrayBuffer;
  contentType: string;
  fileName: string;
  quality?: YouCamQuality;
}): Promise<AnalyzeImageResult> {
  const quality = params.quality ?? "sd";

  const providerFileId = await uploadImageForAnalysis({
    bytes: params.bytes,
    contentType: params.contentType,
    fileName: params.fileName,
  });

  const providerTaskId = await createSkinAnalysisTask({
    fileId: providerFileId,
    concerns: concernsForQuality(quality),
  });

  const statusResponse = await pollTaskUntilComplete(providerTaskId);
  const parsed = parseTaskResult(statusResponse);

  return {
    ...parsed,
    providerFileId,
    providerTaskId,
    rawResult: statusResponse,
  };
}

export interface SimulateImageResult {
  providerFileId: string;
  providerTaskId: string;
  /** Rendered image bytes, already downloaded — the vendor's URL expires in 2 hours, so this never hands back a link. */
  bytes: ArrayBuffer;
  contentType: string;
}

/**
 * Vendor-only orchestration for a goal image: upload -> create simulation
 * task -> poll -> download the result. Same no-database rule as
 * `analyzeImage`; deciding *what* intensities to send lives in
 * `@/lib/face-simulation`, and persistence lives in the db query module.
 *
 * The download happens here rather than at the call site because the
 * presigned result URL is valid for two hours and is the one part of this
 * flow that cannot be retried later from stored state.
 */
export async function simulateImage(params: {
  bytes: ArrayBuffer;
  contentType: string;
  fileName: string;
  intensities: Partial<Record<SimulationParam, number>>;
}): Promise<SimulateImageResult> {
  const providerFileId = await uploadImageForSimulation({
    bytes: params.bytes,
    contentType: params.contentType,
    fileName: params.fileName,
  });

  const providerTaskId = await createSkinSimulationTask({
    fileId: providerFileId,
    intensities: params.intensities,
  });

  const statusResponse = await pollTaskUntilComplete(providerTaskId, {
    endpoint: YOUCAM_SIMULATION_TASK_ENDPOINT,
  });

  const resultUrl = extractResultUrl(statusResponse);
  if (!resultUrl) {
    throw new YouCamError("YouCam simulation succeeded but returned no result URL");
  }

  const res = await fetch(resultUrl);
  if (!res.ok) {
    throw new YouCamError(`Downloading simulation result failed: HTTP ${res.status}`);
  }

  return {
    providerFileId,
    providerTaskId,
    bytes: await res.arrayBuffer(),
    contentType: res.headers.get("Content-Type") ?? "image/jpeg",
  };
}
