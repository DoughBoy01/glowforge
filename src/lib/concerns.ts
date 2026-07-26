import type { YouCamConcern } from "@/lib/youcam/types";

/**
 * Display copy for YouCam's raw per-concern scores — the "technical
 * breakdown" section of the results page. Kept separate from
 * `youcam/constants.ts` since that file is vendor wire-format only; this is
 * UI-facing and can diverge (friendlier labels, longer explanations)
 * without touching the API client.
 */
export const CONCERN_META: Record<YouCamConcern, { label: string; description: string }> = {
  wrinkle: {
    label: "Wrinkles",
    description: "Fine lines and creases from repeated expression and collagen loss.",
  },
  firmness: {
    label: "Firmness",
    description: "Skin elasticity — how well it springs back, a proxy for structural collagen.",
  },
  acne: {
    label: "Acne",
    description: "Active breakouts and inflammation.",
  },
  moisture: {
    label: "Moisture",
    description: "Surface hydration and how well your barrier holds onto water.",
  },
  eye_bag: {
    label: "Eye Bags",
    description: "Under-eye puffiness from fluid retention or fat pad shifts.",
  },
  dark_circle_v2: {
    label: "Dark Circles",
    description: "Under-eye discoloration from thin skin, pigment, or vascular pooling.",
  },
  age_spot: {
    label: "Age Spots",
    description: "Sun-driven pigmentation — the clearest marker of cumulative UV exposure.",
  },
  radiance: {
    label: "Radiance",
    description: "Even tone and light reflection — dull skin scores lower here.",
  },
  redness: {
    label: "Redness",
    description: "Visible inflammation or vascular reactivity.",
  },
  oiliness: {
    label: "Oiliness",
    description: "Excess sebum production, mostly in the T-zone.",
  },
  pore: {
    label: "Pores",
    description: "Pore size and visibility, largely oil- and elasticity-driven.",
  },
  texture: {
    label: "Texture",
    description: "Surface smoothness — roughness here often tracks with barrier health.",
  },
  droopy_upper_eyelid: {
    label: "Upper Eyelid Droop",
    description: "Upper eyelid sag from skin laxity.",
  },
  droopy_lower_eyelid: {
    label: "Lower Eyelid Droop",
    description: "Lower eyelid sag from skin laxity.",
  },
};
