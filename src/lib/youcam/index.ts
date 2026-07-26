import { concernsForQuality, type YouCamQuality } from "./constants";
import {
  createSkinAnalysisTask,
  pollTaskUntilComplete,
  uploadImageForAnalysis,
} from "./client";
import { parseTaskResult, type ParsedAnalysisResult } from "./transform";

export * from "./errors";
export * from "./types";
export * from "./constants";
export {
  uploadImageForAnalysis,
  createSkinAnalysisTask,
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
