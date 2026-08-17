/** Base class for any failure talking to the YouCam API (network, HTTP, vendor task error). */
export class YouCamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YouCamError";
  }
}

/** Non-2xx HTTP response from the YouCam API. */
export class YouCamApiError extends YouCamError {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "YouCamApiError";
  }
}

/** 429 — caller exceeded 5 QPS / 250 req per 300s. Carries a suggested retry delay. */
export class YouCamRateLimitError extends YouCamApiError {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
  ) {
    super(message, 429, "rate_limited");
    this.name = "YouCamRateLimitError";
  }
}

/** Vendor rejected the input image itself — not worth retrying without a new photo. */
export class YouCamInputError extends YouCamError {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "YouCamInputError";
  }
}

/** Task reached status "error" after being accepted (as opposed to a rejected request). */
export class YouCamTaskFailedError extends YouCamError {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "YouCamTaskFailedError";
  }
}

/** Polling exceeded the configured budget without the task reaching a terminal state. */
export class YouCamTimeoutError extends YouCamError {
  constructor(message: string) {
    super(message);
    this.name = "YouCamTimeoutError";
  }
}

const INPUT_ERROR_CODES = new Set([
  "error_no_face",
  "error_nsfw_content_detected",
  "error_below_min_image_size",
  "error_src_face_too_small",
  "exceed_max_filesize",
  "invalid_parameters",
  "InvalidParameters",
]);

export function isInputErrorCode(code: string | undefined): boolean {
  return !!code && INPUT_ERROR_CODES.has(code);
}

/** User-facing copy for each known input-rejection code — no stack traces on the UI. */
export function describeInputError(code: string): string {
  switch (code) {
    case "error_no_face":
      return "We couldn't detect a face in that photo. Try a well-lit, front-facing shot with your whole face visible.";
    case "error_nsfw_content_detected":
      return "That photo was flagged by content moderation. Please upload a different photo.";
    case "error_below_min_image_size":
      return "That photo's resolution is too low. Try a clearer, higher-resolution shot.";
    case "error_src_face_too_small":
      return "Your face takes up too little of the frame. Try moving closer to the camera.";
    case "exceed_max_filesize":
      return "That photo is too large (10MB max). Try a smaller image.";
    case "invalid_parameters":
    case "InvalidParameters":
      return "That photo couldn't be processed. Try retaking it in better lighting.";
    default:
      return "That photo couldn't be analyzed. Try a different photo.";
  }
}

/**
 * Maps any thrown error to a stored (code, user-facing message) pair. Lives
 * here rather than in `skin-analysis.ts` so both that module and
 * `skin-prediction.ts` can share it without importing each other — the two
 * background jobs are siblings, not a dependency chain.
 */
export function describeFailure(err: unknown): { code: string; message: string } {
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
