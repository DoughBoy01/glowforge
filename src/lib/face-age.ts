import { differenceInCalendarDays } from "date-fns";

/**
 * Face age — the number this product exists to move.
 *
 * Everything else in the app is a means to it: the four metric scores say
 * *what* is aging the face, the routine and the gym are the work, the progress
 * charts are the evidence. This is the scoreboard. It lives in one file so no
 * screen can invent its own version of the mission.
 *
 * Two honesty rules, and both are load-bearing:
 *
 * 1. **The mission is measured against the user's own baseline, never against
 *    their real age.** We don't collect a date of birth, so "you look five years
 *    younger than you are" is a sentence we have no data for. What we do have is
 *    their first analysed photo and every reading since — so the win condition
 *    is "fewer years than you started with". True, and harder to game.
 * 2. **Only a scan moves this number.** Face age comes out of the vendor's
 *    analysis of a photo. Logging a routine doesn't move it and finishing a gym
 *    session doesn't move it — those are the inputs that might, by the next
 *    scan. Copy near this number has to keep cause and effect straight, or the
 *    app is inventing a causal claim to drive engagement.
 */

/** What every screen calls it. Imported rather than retyped so it can't drift. */
export const FACE_AGE_LABEL = "Face age";

/** The mission, in the fewest words that still say which direction is winning. */
export const FACE_AGE_MISSION = "Fewer years on your face than you started with.";

export interface FaceAgeReading {
  scanId: string;
  capturedAt: Date;
  /** Years, estimated from that check-in's photo. */
  faceAge: number;
}

export type MissionState =
  /** No analysed photo yet — there's no scoreboard to show. */
  | "unmeasured"
  /** Exactly one reading: the line is set, but nothing to compare it to. */
  | "baseline"
  /** Below baseline. The only state the mission calls a win. */
  | "ahead"
  /** Above baseline. */
  | "behind"
  /** Exactly at baseline. */
  | "level";

export interface FaceAgeMission {
  state: MissionState;
  /** The latest reading — the big number on the hero. */
  current: number | null;
  /** The first reading ever. What the mission is scored against. */
  baseline: number | null;
  /** The reading before the latest, for the scan-over-scan move. */
  previous: number | null;
  /** `baseline − current`. Positive is the win: years off the face. */
  yearsShed: number | null;
  /** `current − previous`. Negative is the win. Null on the first reading. */
  lastMove: number | null;
  /** Calendar days from the baseline reading to the latest one. */
  daysTracked: number;
  /** How many check-ins carry a face age at all. */
  readings: number;
  /** Lowest face age on record. Ties resolve to the most recent, so standing at your record counts as being there. */
  best: FaceAgeReading | null;
  /** True when the latest reading is the lowest on record. */
  atBest: boolean;
}

const EMPTY_MISSION: FaceAgeMission = {
  state: "unmeasured",
  current: null,
  baseline: null,
  previous: null,
  yearsShed: null,
  lastMove: null,
  daysTracked: 0,
  readings: 0,
  best: null,
  atBest: false,
};

/** "1 year" / "3 years", so no caller has to remember the plural. */
export function years(n: number): string {
  const magnitude = Math.abs(n);
  return `${magnitude} year${magnitude === 1 ? "" : "s"}`;
}

/**
 * The mission, from every face age the user has on record.
 *
 * `readings` must be chronological, oldest first — `getFaceAgeReadings` returns
 * them that way. It has to be the *complete* history rather than a page of it:
 * the baseline is the whole point of the comparison, and computing it from the
 * last dozen scans would silently redefine "where you started" every time
 * someone checks in.
 */
export function buildFaceAgeMission(readings: FaceAgeReading[]): FaceAgeMission {
  if (readings.length === 0) return EMPTY_MISSION;

  const first = readings[0];
  const latest = readings[readings.length - 1];
  const previous = readings.length > 1 ? readings[readings.length - 2] : null;
  const yearsShed = readings.length > 1 ? first.faceAge - latest.faceAge : null;

  // `<=` so a tie resolves to the later reading: standing level with your record
  // should read as being at it, not as having once been there.
  const best = readings.reduce((lowest, r) => (r.faceAge <= lowest.faceAge ? r : lowest));

  const state: MissionState =
    readings.length === 1
      ? "baseline"
      : latest.faceAge < first.faceAge
        ? "ahead"
        : latest.faceAge > first.faceAge
          ? "behind"
          : "level";

  return {
    state,
    current: latest.faceAge,
    baseline: first.faceAge,
    previous: previous?.faceAge ?? null,
    yearsShed,
    lastMove: previous ? latest.faceAge - previous.faceAge : null,
    daysTracked: differenceInCalendarDays(latest.capturedAt, first.capturedAt),
    readings: readings.length,
    best,
    atBest: latest.faceAge <= best.faceAge,
  };
}

/**
 * The mission's status line — the headline and sentence that sit under the
 * number on the home screen.
 *
 * Notice what none of these say: anything about how the user looks. The number
 * is a measurement of a photo, and the copy's job is to report which way it's
 * moved and what moves it next.
 */
export function getMissionLine(mission: FaceAgeMission): { headline: string; body: string } {
  const { state, current, baseline, yearsShed, daysTracked } = mission;

  if (state === "unmeasured" || current === null || baseline === null) {
    // Reached in two situations that look the same from here: nobody has
    // checked in yet, and somebody just has but the photo analysis hasn't
    // landed. Worded to be true in both, since a line about taking your first
    // scan is confusing to read thirty seconds after taking it.
    return {
      headline: "Not measured yet",
      body: "Your face age comes from an analysed photo. Once one lands, it becomes the number everything after it is measured against.",
    };
  }

  if (state === "baseline") {
    return {
      headline: `${current} to beat`,
      body: "That's your line. From here the mission runs one direction, and it isn't up.",
    };
  }

  // Only reachable with two readings, so `yearsShed` is set.
  const shed = yearsShed!;
  // Two readings can share a capture date, which makes the window zero days —
  // "over 0 days" is worse than saying nothing.
  const window = daysTracked > 0 ? ` in ${daysTracked} days` : "";

  if (state === "ahead") {
    // Note what this doesn't say: that the routine caused it. We measured a
    // photo, and we can't separate the work from sleep, season or lighting.
    // "Keep going and find out" is the honest version, and it happens to be
    // the more motivating one.
    return {
      headline: `${years(shed)} off`,
      body: `Down from ${baseline}${window}. Keep the work below going and the next scan says whether it holds.`,
    };
  }

  if (state === "level") {
    return {
      headline: "Level with baseline",
      body: `Back at ${baseline}${window} — exactly where you started. Nothing lost, nothing banked.`,
    };
  }

  return {
    headline: `${years(shed)} on`,
    body: `Up from ${baseline}${window}. Plenty moves this that isn't your fault — the work below is the part you control.`,
  };
}

/**
 * How a given piece of daily work relates to the number.
 *
 * This exists to stop the app overclaiming. It would be easy — and it would
 * read well — to tell someone that every tick on the home screen is shaving
 * years off their face. But the face age reading is derived from photo analysis
 * of skin: pigmentation, texture, firmness, the eye area. So:
 *
 * - `measures` — the scan. The only thing that writes a new face age.
 * - `targets` — works on something the reading is actually made of. Skincare.
 * - `unmeasured` — work we stand behind that this reading cannot see. Face gym
 *   trains muscle; the analysis doesn't grade muscle tone. Saying otherwise
 *   would be inventing a result the data can't support.
 */
export type MissionLink = "measures" | "targets" | "unmeasured";

/** The honest half-sentence tying one piece of work to the mission. */
export const MISSION_LINK_COPY: Record<MissionLink, string> = {
  measures: "Sets the number",
  targets: "Moves the number",
  unmeasured: "Not in the number",
};
