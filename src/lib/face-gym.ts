/**
 * Face Gym — the session definition.
 *
 * This array is the single source of truth: it sets the order, the copy, and
 * which file each round plays. Reorder, rename, add or delete entries here and
 * the player, the round list and the session length all follow.
 *
 * `file` is a filename inside `public/face-gym/` — the manifest points at the
 * clips rather than the clips having to be named a particular way. A file
 * that isn't there yet doesn't break the session: the player names the one it
 * expected and the round still counts down, so the list doubles as a checklist
 * of what's left to shoot. See `public/face-gym/README.md`.
 */

export interface FaceGymExercise {
  /** Stable id — React keys, and anything we later want to measure per round. */
  slug: string;
  /** Filename inside `public/face-gym/`. */
  file: string;
  name: string;
  /** Which of the 43 this round actually works. */
  target: string;
  /** One-line form cue, held on screen for the whole round. */
  cue: string;
}

/** Every round is one minute. Long enough to burn, short enough to finish. */
export const FACE_GYM_ROUND_SECONDS = 60;

export const FACE_GYM_EXERCISES: FaceGymExercise[] = [
  {
    slug: "cheek-lift",
    file: "gym.mp4",
    name: "Cheek Lift",
    target: "Zygomaticus major",
    cue: "Fingertips flat on the cheekbones. Smile hard against them — fingers push down, cheeks push up.",
  },
  {
    slug: "cheek-puff",
    file: "gym2.mp4",
    name: "Cheek Puff",
    target: "Buccinator & orbicularis oris",
    cue: "Fill both cheeks with air, lips sealed. Hold it, then roll the air side to side without letting any out.",
  },
  {
    slug: "jaw-drop",
    file: "gym1.mp4",
    name: "Jaw Drop",
    target: "Masseter & digastric",
    cue: "Open as wide as it goes, tongue flat. Hold two counts at the bottom, then close slower than you opened.",
  },
];

/** Where the mp4s live. */
export const FACE_GYM_VIDEO_DIR = "/face-gym";

export function faceGymVideoSrc(file: string) {
  return `${FACE_GYM_VIDEO_DIR}/${file}`;
}

/** Whole-session length, for the "N rounds · M min" line. */
export const FACE_GYM_TOTAL_SECONDS = FACE_GYM_EXERCISES.length * FACE_GYM_ROUND_SECONDS;

/** `m:ss` — the countdown reads as a clock, not a number of seconds. */
export function formatCountdown(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(whole / 60);
  return `${mins}:${String(whole % 60).padStart(2, "0")}`;
}
