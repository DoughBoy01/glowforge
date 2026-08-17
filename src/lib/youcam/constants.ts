/**
 * YouCam (Perfect Corp) Skin Analysis S2S API — v2.0. Bearer-token auth,
 * no separate token exchange (that's the deprecated v1 flow).
 * https://yce.perfectcorp.com/document/index.html
 */
export const YOUCAM_API_BASE = "https://yce-api-01.makeupar.com/s2s/v2.0";
export const YOUCAM_FILE_ENDPOINT = `${YOUCAM_API_BASE}/file/skin-analysis`;
export const YOUCAM_TASK_ENDPOINT = `${YOUCAM_API_BASE}/task/skin-analysis`;

/**
 * AI Skin Simulation — a *separate* feature with its own file and task
 * endpoints, used to render the "where this could get to" goal image on the
 * results page. Uploads are per-feature: a `file_id` minted by
 * `/file/skin-analysis` is not accepted by `/task/skin-simulation`, so the
 * same photo gets uploaded twice, once per feature. Don't "optimize" that by
 * reusing the analysis file id.
 */
export const YOUCAM_SIMULATION_FILE_ENDPOINT = `${YOUCAM_API_BASE}/file/skin-simulation`;
export const YOUCAM_SIMULATION_TASK_ENDPOINT = `${YOUCAM_API_BASE}/task/skin-simulation`;

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

/**
 * The ten simulation parameters, exactly as the vendor names them on the
 * `/task/skin-simulation` body. They are flat top-level floats next to
 * `src_file_id` — not a nested object, and not the `dst_actions` array the
 * analysis endpoint takes. Note the spelling drift against the analysis
 * concern enum: `eye_bags`/`pores`/`spots` are plural here but singular
 * (`eye_bag`/`pore`) or differently named (`age_spot`) there, and
 * `dark_circle` drops the `_v2` suffix. `SIMULATION_PARAM_FOR_CONCERN` in
 * `@/lib/face-simulation` is the crosswalk; don't map by string munging.
 */
export const SIMULATION_PARAMS = [
  "wrinkle",
  "radiance",
  "oiliness",
  "acne",
  "eye_bags",
  "dark_circle",
  "spots",
  "pores",
  "texture",
  "redness",
] as const;

export type SimulationParam = (typeof SIMULATION_PARAMS)[number];

/**
 * Each param is 0.0–1.0, where 0.0 is the untouched photo and 1.0 is the
 * strongest correction the model will render.
 *
 * `oiliness` is the exception and it is inverted: the vendor documents 1.0 as
 * "maximum oil/shine **added** to skin". Turning it up makes the face shinier,
 * not matte. Anything building a goal image has to leave it at 0 — see
 * `deriveSimulationParams`, which hard-zeroes it.
 */
export const SIMULATION_PARAM_MIN = 0;
export const SIMULATION_PARAM_MAX = 1;

/**
 * The vendor rejects a task whose parameters are all zero (it's expressed as
 * a JSON-Schema `not` clause, and surfaces as the unhelpful message
 * "Instance matched a schema which it should not have"). Callers must send at
 * least one non-zero param.
 */
export const SIMULATION_MIN_NONZERO_PARAMS = 1;

/** 10MB hard cap enforced by the vendor — checked client-side before upload. */
export const YOUCAM_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const YOUCAM_POLL_INTERVAL_MS = 2_000;
export const YOUCAM_POLL_MAX_INTERVAL_MS = 8_000;
export const YOUCAM_POLL_TIMEOUT_MS = 90_000;

export const YOUCAM_REQUEST_TIMEOUT_MS = 15_000;
export const YOUCAM_MAX_RETRIES = 3;
