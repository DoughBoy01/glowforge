import type { SD_CONCERNS } from "./constants";

export type YouCamConcern = (typeof SD_CONCERNS)[number];

export type YouCamTaskStatus = "running" | "success" | "error";

/**
 * Wire types below were verified against the live API (2026-07-24) rather
 * than trusting Perfect Corp's public docs, which don't publish a
 * machine-readable schema and have disagreed with the live behavior on
 * envelope nesting. Every response body is wrapped in a top-level `data`
 * key across all three endpoints (file upload, task create, task status) —
 * `result` and flat fields are kept as fallbacks below in case that drifts
 * again, and `parseTaskResult` in `transform.ts` still tries several known
 * inner shapes for `results` since a real "success" payload hasn't been
 * captured yet. Every raw response is persisted to `skinAnalyses.rawResult`,
 * so parsing can be replayed against real stored payloads without
 * re-calling the vendor.
 */

export interface YouCamFileUploadFile {
  file_id: string;
  /** Presigned upload request — nested here, not flat on the file entry. */
  requests?: { method?: string; url: string; headers?: Record<string, string> }[];
  /** Fallback for a flatter shape, if the vendor ever ships one. */
  url?: string;
  headers?: Record<string, string>;
}

export interface YouCamFileUploadResponse {
  data?: { files?: YouCamFileUploadFile[] };
  result?: { files?: YouCamFileUploadFile[] };
  files?: YouCamFileUploadFile[];
}

export interface YouCamTaskCreateResponse {
  data?: { task_id?: string };
  result?: { task_id?: string };
  task_id?: string;
}

export interface YouCamConcernResult {
  raw_score?: number;
  ui_score?: number;
  output_mask_name?: string;
  mask_url?: string;
  type?: string;
}

export interface YouCamErrorBody {
  error?: { code?: string; message?: string };
  error_code?: string;
  code?: string;
  message?: string;
}

/**
 * GET .../task/skin-analysis/{task_id} response. The real body is
 * `{ status: 200, data: { task_status, error, results, skin_age } }` — note
 * `task_status` (not `status`) inside `data`, and `error` is a plain string
 * code (e.g. `"error_below_min_image_size"`), not `{code, message}`.
 */
export interface YouCamTaskStatusResponse {
  data?: {
    task_status?: YouCamTaskStatus;
    error?: string | { code?: string; message?: string };
    skin_age?: number;
    result?: Record<string, unknown>;
    results?: { output?: unknown; skin_age?: number };
  };
  // Flat fallbacks, kept in case the envelope drifts again.
  status?: YouCamTaskStatus;
  task_id?: string;
  error?: string | { code?: string; message?: string };
  skin_age?: number;
  result?: Record<string, unknown>;
  results?: { output?: unknown; skin_age?: number };
}
