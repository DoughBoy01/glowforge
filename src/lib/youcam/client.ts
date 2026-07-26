import {
  YOUCAM_FILE_ENDPOINT,
  YOUCAM_TASK_ENDPOINT,
  YOUCAM_MAX_FILE_SIZE_BYTES,
  YOUCAM_MAX_RETRIES,
  YOUCAM_POLL_INTERVAL_MS,
  YOUCAM_POLL_MAX_INTERVAL_MS,
  YOUCAM_POLL_TIMEOUT_MS,
  YOUCAM_REQUEST_TIMEOUT_MS,
} from "./constants";
import {
  YouCamApiError,
  YouCamError,
  YouCamInputError,
  YouCamRateLimitError,
  YouCamTaskFailedError,
  YouCamTimeoutError,
  isInputErrorCode,
} from "./errors";
import type {
  YouCamErrorBody,
  YouCamFileUploadResponse,
  YouCamTaskCreateResponse,
  YouCamTaskStatusResponse,
} from "./types";

function getApiKey(): string {
  const key = process.env.YOUCAM_API_KEY;
  if (!key) throw new YouCamError("YOUCAM_API_KEY is not set");
  return key;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseErrorBody(res: Response): Promise<{ code?: string; message: string }> {
  try {
    const body = (await res.json()) as YouCamErrorBody;
    const code = body.error?.code ?? body.error_code ?? body.code;
    const message = body.error?.message ?? body.message ?? res.statusText;
    return { code, message };
  } catch {
    return { message: res.statusText || `HTTP ${res.status}` };
  }
}

/**
 * Bearer-authenticated fetch with a per-request timeout and bounded retries
 * on transient failures (429 with backoff honoring Retry-After, and 5xx).
 * Non-retryable 4xx (bad input, bad auth) fail fast on the first attempt.
 */
async function youcamFetch(url: string, init: RequestInit, attempt = 1): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), YOUCAM_REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    if (attempt >= YOUCAM_MAX_RETRIES) {
      throw new YouCamError(
        `Network error calling YouCam API after ${attempt} attempts: ${(err as Error).message}`,
      );
    }
    await sleep(2 ** attempt * 250);
    return youcamFetch(url, init, attempt + 1);
  }
  clearTimeout(timeout);

  if (res.ok) return res;

  if (res.status === 429) {
    const retryAfterHeader = res.headers.get("Retry-After");
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 2000;
    if (attempt >= YOUCAM_MAX_RETRIES) {
      throw new YouCamRateLimitError(
        "YouCam API rate limit exceeded (5 req/s, 250 req/5min)",
        retryAfterMs,
      );
    }
    await sleep(retryAfterMs);
    return youcamFetch(url, init, attempt + 1);
  }

  if (res.status >= 500 && attempt < YOUCAM_MAX_RETRIES) {
    await sleep(2 ** attempt * 250);
    return youcamFetch(url, init, attempt + 1);
  }

  const { code, message } = await parseErrorBody(res);
  if (isInputErrorCode(code)) throw new YouCamInputError(message, code!);
  throw new YouCamApiError(message, res.status, code);
}

/**
 * Uploads an image to YouCam's staging storage: request a presigned URL via
 * the file API, then PUT the bytes directly to it. Returns the `file_id`
 * used to create an analysis task.
 */
export async function uploadImageForAnalysis(params: {
  bytes: ArrayBuffer;
  contentType: string;
  fileName: string;
}): Promise<string> {
  if (params.bytes.byteLength > YOUCAM_MAX_FILE_SIZE_BYTES) {
    throw new YouCamInputError(
      `Image is ${(params.bytes.byteLength / 1024 / 1024).toFixed(1)}MB, exceeds the 10MB limit`,
      "exceed_max_filesize",
    );
  }

  const initRes = await youcamFetch(YOUCAM_FILE_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({
      files: [
        {
          content_type: params.contentType,
          file_name: params.fileName,
          file_size: params.bytes.byteLength,
        },
      ],
    }),
  });
  const initBody = (await initRes.json()) as YouCamFileUploadResponse;
  const file = initBody.data?.files?.[0] ?? initBody.result?.files?.[0] ?? initBody.files?.[0];
  // The presigned upload request is nested under `requests[0]`, not flat on the file entry.
  const uploadReq = file?.requests?.[0];
  const uploadUrl = uploadReq?.url ?? file?.url;
  if (!file?.file_id || !uploadUrl) {
    throw new YouCamError("YouCam file upload response missing file_id/url");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    body: params.bytes,
    headers: { "Content-Type": params.contentType, ...(uploadReq?.headers ?? file.headers) },
  });
  if (!uploadRes.ok) {
    throw new YouCamError(
      `Uploading image to YouCam storage failed: HTTP ${uploadRes.status}`,
    );
  }

  return file.file_id;
}

/** Creates a skin-analysis task for a previously uploaded file. Returns the task id to poll. */
export async function createSkinAnalysisTask(params: {
  fileId: string;
  concerns: readonly string[];
}): Promise<string> {
  const res = await youcamFetch(YOUCAM_TASK_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({
      src_file_id: params.fileId,
      dst_actions: params.concerns,
      format: "json",
    }),
  });
  const body = (await res.json()) as YouCamTaskCreateResponse;
  const taskId = body.data?.task_id ?? body.result?.task_id ?? body.task_id;
  if (!taskId) throw new YouCamError("YouCam task creation response missing task_id");
  return taskId;
}

/** Normalizes the real `{status, data: {task_status, ...}}` envelope onto the flat fields callers expect. */
function normalizeTaskStatus(body: YouCamTaskStatusResponse): YouCamTaskStatusResponse {
  const data = body.data;
  if (!data) return body;
  return {
    ...body,
    status: data.task_status ?? body.status,
    error: data.error ?? body.error,
    skin_age: data.skin_age ?? body.skin_age,
    result: data.result ?? body.result,
    results: data.results ?? body.results,
  };
}

export async function getTaskStatus(taskId: string): Promise<YouCamTaskStatusResponse> {
  const res = await youcamFetch(`${YOUCAM_TASK_ENDPOINT}/${taskId}`, { method: "GET" });
  const body = (await res.json()) as YouCamTaskStatusResponse;
  return normalizeTaskStatus(body);
}

/**
 * Polls a task to completion with capped exponential backoff. Resolves with
 * the raw "success" payload; throws `YouCamTaskFailedError` if the vendor
 * reports `status: "error"`, or `YouCamTimeoutError` if `timeoutMs` elapses
 * first (the caller can retry the poll later — the task keeps running
 * server-side on the vendor's end regardless of whether we're watching it).
 */
export async function pollTaskUntilComplete(
  taskId: string,
  opts: { timeoutMs?: number; onStatus?: (status: YouCamTaskStatusResponse) => void } = {},
): Promise<YouCamTaskStatusResponse> {
  const timeoutMs = opts.timeoutMs ?? YOUCAM_POLL_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  let interval = YOUCAM_POLL_INTERVAL_MS;

  for (;;) {
    const status = await getTaskStatus(taskId);
    opts.onStatus?.(status);

    if (status.status === "success") return status;
    if (status.status === "error") {
      // The vendor returns `error` as a plain code string (e.g.
      // "error_below_min_image_size"), not the {code, message} object the
      // docs imply — handle both.
      const errCode = typeof status.error === "string" ? status.error : status.error?.code;
      const errMessage = typeof status.error === "string" ? status.error : status.error?.message;
      throw new YouCamTaskFailedError(errMessage ?? "YouCam analysis task failed", errCode);
    }

    if (Date.now() + interval > deadline) {
      throw new YouCamTimeoutError(
        `YouCam task ${taskId} did not complete within ${timeoutMs}ms`,
      );
    }
    await sleep(interval);
    interval = Math.min(interval * 1.5, YOUCAM_POLL_MAX_INTERVAL_MS);
  }
}
