import { TRACKED_METRICS, type TrackedMetric } from "@/lib/metrics";
import type { YouCamConcern } from "./types";
import type { YouCamTaskStatusResponse } from "./types";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

interface RawConcernFields {
  raw_score?: number;
  ui_score?: number;
  score?: number;
  mask_url?: string;
}

/** The vendor puts mask images under `mask_urls` (an array) — `mask_url` (singular) is only a defensive fallback for a shape we've never actually seen. */
function firstMaskUrl(x: Record<string, unknown>): string | undefined {
  if (typeof x.mask_url === "string") return x.mask_url;
  if (Array.isArray(x.mask_urls) && typeof x.mask_urls[0] === "string") return x.mask_urls[0];
  return undefined;
}

function asConcernFields(x: unknown): RawConcernFields | null {
  if (!isRecord(x)) return null;
  const rawScore = typeof x.raw_score === "number" ? x.raw_score : undefined;
  const uiScore = typeof x.ui_score === "number" ? x.ui_score : undefined;
  // The "all" (overall) and "skin_age" entries carry a bare `score` instead
  // of raw_score/ui_score — everything else (mask_urls-only "resize_image")
  // has none of the three and correctly falls through to null below.
  const score = typeof x.score === "number" ? x.score : undefined;
  if (rawScore === undefined && uiScore === undefined && score === undefined) return null;
  return {
    raw_score: rawScore,
    ui_score: uiScore,
    score,
    mask_url: firstMaskUrl(x),
  };
}

export interface ParsedConcern {
  concern: string;
  rawScore: number;
  uiScore: number;
  maskUrl?: string;
}

export interface ParsedAnalysisResult {
  concerns: ParsedConcern[];
  skinAge: number | null;
  providerOverallScore: number | null;
}

const NON_CONCERN_KEYS = new Set(["task_id", "status", "error"]);

/**
 * Normalizes a YouCam task-status "success" payload into a flat concern
 * list. Tries a few known envelope shapes (see the note in `types.ts` on
 * why this can't assume one canonical shape) — falls back gracefully to an
 * empty concern list rather than throwing, so a shape drift degrades to
 * "no AI metrics this scan" instead of a hard failure.
 */
export function parseTaskResult(raw: YouCamTaskStatusResponse): ParsedAnalysisResult {
  const concerns: ParsedConcern[] = [];
  let providerOverallScore: number | null = null;
  let skinAgeFromOutput: number | null = null;

  const pushEntry = (name: string, entry: unknown) => {
    const fields = asConcernFields(entry);
    if (!fields) return;
    if (name === "all") {
      providerOverallScore = Math.round(fields.score ?? fields.ui_score ?? fields.raw_score ?? 0);
      return;
    }
    if (name === "skin_age") {
      skinAgeFromOutput = Math.round(fields.score ?? 0);
      return;
    }
    const rawScore = Math.round(fields.raw_score ?? fields.ui_score ?? 0);
    const uiScore = Math.round(fields.ui_score ?? fields.raw_score ?? 0);
    concerns.push({ concern: name, rawScore, uiScore, maskUrl: fields.mask_url });
  };

  // `results` is a union — only its object form carries analysis output.
  const results = Array.isArray(raw.results) ? undefined : raw.results;
  const output = results?.output;
  if (Array.isArray(output)) {
    for (const entry of output) {
      if (isRecord(entry) && typeof entry.type === "string") pushEntry(entry.type, entry);
    }
  } else if (isRecord(output)) {
    for (const [name, entry] of Object.entries(output)) pushEntry(name, entry);
  } else if (isRecord(raw.result)) {
    for (const [name, entry] of Object.entries(raw.result)) {
      if (NON_CONCERN_KEYS.has(name)) continue;
      pushEntry(name, entry);
    }
  }

  const skinAge =
    skinAgeFromOutput ??
    (typeof raw.skin_age === "number"
      ? raw.skin_age
      : typeof results?.skin_age === "number"
        ? results.skin_age
        : isRecord(raw.result) && typeof raw.result.skin_age === "number"
          ? raw.result.skin_age
          : null);

  return { concerns, skinAge, providerOverallScore };
}

/**
 * Maps YouCam's raw concerns onto GlowForge's four tracked metrics. Weights
 * are a deliberate product simplification, not a clinical claim:
 *  - sun_damage leans on pigmentation/photoaging signals — age spots are
 *    the clearest UV marker, wrinkles/redness/radiance are secondary.
 *  - firmness leans on the vendor's own `firmness` concern plus texture and
 *    eyelid droop (split evenly across upper/lower), which correlate with
 *    structural skin quality.
 *  - eye_area is exactly the two vendor concerns scoped to that region.
 *  - moisture maps 1:1 to the vendor's `moisture` concern — nothing else in
 *    the vendor's list measures barrier hydration, so blending anything
 *    else in would dilute rather than improve the signal.
 * Concerns not referenced here (acne, pore, oiliness, texture outside
 * firmness) still get stored as raw `skinConcernScores` for a technical
 * detail view — they just don't roll into a headline metric because
 * they're outside this product's four tracked dimensions.
 */
const METRIC_CONCERN_WEIGHTS: Record<TrackedMetric, Partial<Record<YouCamConcern, number>>> = {
  sun_damage: { age_spot: 0.4, wrinkle: 0.2, redness: 0.2, radiance: 0.2 },
  firmness: {
    firmness: 0.6,
    droopy_upper_eyelid: 0.125,
    droopy_lower_eyelid: 0.125,
    texture: 0.15,
  },
  eye_area: { eye_bag: 0.5, dark_circle_v2: 0.5 },
  moisture: { moisture: 1 },
};

/**
 * Renormalizes over whatever concerns are actually present, so a partial
 * result or a future vendor field change degrades gracefully instead of
 * under-scoring. Returns null for a metric only if every one of its input
 * concerns is missing.
 */
export function mapConcernsToTrackedMetrics(
  concerns: ParsedConcern[],
): Partial<Record<TrackedMetric, number>> {
  const byName = new Map(concerns.map((c) => [c.concern, c]));
  const result: Partial<Record<TrackedMetric, number>> = {};

  for (const metric of TRACKED_METRICS) {
    const weights = METRIC_CONCERN_WEIGHTS[metric];
    let weightedSum = 0;
    let weightTotal = 0;
    for (const [concern, weight] of Object.entries(weights) as [YouCamConcern, number][]) {
      const found = byName.get(concern);
      if (!found) continue;
      weightedSum += found.uiScore * weight;
      weightTotal += weight;
    }
    if (weightTotal > 0) result[metric] = Math.round(weightedSum / weightTotal);
  }

  return result;
}
