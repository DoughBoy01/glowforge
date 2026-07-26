/**
 * YouCam (Perfect Corp) Skin Analysis S2S API — v2.0. Bearer-token auth,
 * no separate token exchange (that's the deprecated v1 flow).
 * https://yce.perfectcorp.com/document/index.html
 */
export const YOUCAM_API_BASE = "https://yce-api-01.makeupar.com/s2s/v2.0";
export const YOUCAM_FILE_ENDPOINT = `${YOUCAM_API_BASE}/file/skin-analysis`;
export const YOUCAM_TASK_ENDPOINT = `${YOUCAM_API_BASE}/task/skin-analysis`;

/**
 * Concerns available on standard-definition input (short side >= 480px),
 * verified against the live API's `dst_actions` validation error (it lists
 * the full valid enum in its 400 body). Two corrections vs. the vendor's
 * public docs: the dark-circle concern is `dark_circle_v2`, not
 * `dark_circle`, and eyelid droop is split into `droopy_upper_eyelid` /
 * `droopy_lower_eyelid` — both available at SD tier, not HD-exclusive as
 * previously assumed here.
 */
export const SD_CONCERNS = [
  "wrinkle",
  "firmness",
  "acne",
  "moisture",
  "eye_bag",
  "dark_circle_v2",
  "age_spot",
  "radiance",
  "redness",
  "oiliness",
  "pore",
  "texture",
  "droopy_upper_eyelid",
  "droopy_lower_eyelid",
] as const;

/**
 * HD-tier concerns use an `hd_` prefix on the same underlying concern name
 * (also confirmed via the live 400 body) — except `dark_circle_v2`, whose
 * HD form drops the `_v2` suffix (`hd_dark_circle`), the one asymmetric
 * case. HD additionally unlocks regional per-location breakdowns of
 * pore/wrinkle that this integration doesn't model separately.
 */
export const HD_CONCERNS = SD_CONCERNS.map((c) =>
  c === "dark_circle_v2" ? "hd_dark_circle" : (`hd_${c}` as const),
);

export type YouCamQuality = "sd" | "hd";

export function concernsForQuality(quality: YouCamQuality): readonly string[] {
  return quality === "hd" ? HD_CONCERNS : SD_CONCERNS;
}

/** 10MB hard cap enforced by the vendor — checked client-side before upload. */
export const YOUCAM_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const YOUCAM_POLL_INTERVAL_MS = 2_000;
export const YOUCAM_POLL_MAX_INTERVAL_MS = 8_000;
export const YOUCAM_POLL_TIMEOUT_MS = 90_000;

export const YOUCAM_REQUEST_TIMEOUT_MS = 15_000;
export const YOUCAM_MAX_RETRIES = 3;
