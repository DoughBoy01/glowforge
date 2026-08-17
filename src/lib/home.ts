import { differenceInCalendarDays, addDays } from "date-fns";
import type { FaceGymStats } from "@/db/queries/face-gym";
import { getFaceGymRowLine } from "@/lib/face-gym-coach";
import type { MissionLink } from "@/lib/face-age";

/**
 * How often a check-in is expected.
 *
 * Four weeks, on the reasoning that epidermal turnover is roughly a month and a
 * new habit takes about that long to reach the surface — so a shorter gap mostly
 * measures the things a scan can't control for, lighting and sleep and how
 * recently you washed your face. Whether the trend is genuinely quieter at 28
 * days than at 7 is not something we've measured; this is the product decision,
 * not a finding.
 *
 * It's also the reason check-in isn't in the tab bar and the home screen is
 * built around the daily habits instead — see `NAV_ITEMS` and `buildTodayBoard`.
 */
export const CHECK_IN_INTERVAL_DAYS = 28;

export interface CheckInEligibility {
  eligible: boolean;
  /** Set only when ineligible — the calendar date a new scan is allowed. */
  nextEligibleAt: Date | null;
  /** Set only when ineligible — always >= 1. */
  daysRemaining: number;
}

/**
 * Gates a new scan to once every `CHECK_IN_INTERVAL_DAYS`. Enforced (not just
 * advisory copy like `buildTodayBoard`'s "Scan due" row) because each scan
 * triggers a paid AI analysis call — letting people re-scan daily would let
 * the API bill scale with impatience instead of with the epidermal turnover
 * window the cadence is actually built around.
 *
 * A scan whose analysis failed produced no usable result, so it shouldn't
 * spend the cooldown — `lastScanFailed: true` is treated the same as no scan
 * at all. Without this, the "Try another check-in" retry on the results
 * page's failure card (see `scans/[scanId]/page.tsx`) leads straight back
 * into a 28-day wall for a photo that was never scored.
 */
export function getCheckInEligibility({
  lastScanAt,
  lastScanFailed = false,
  now = new Date(),
}: {
  lastScanAt: Date | null;
  lastScanFailed?: boolean;
  now?: Date;
}): CheckInEligibility {
  if (!lastScanAt || lastScanFailed) {
    return { eligible: true, nextEligibleAt: null, daysRemaining: 0 };
  }

  const daysSinceScan = differenceInCalendarDays(now, lastScanAt);
  if (daysSinceScan >= CHECK_IN_INTERVAL_DAYS) {
    return { eligible: true, nextEligibleAt: null, daysRemaining: 0 };
  }

  return {
    eligible: false,
    nextEligibleAt: addDays(lastScanAt, CHECK_IN_INTERVAL_DAYS),
    daysRemaining: CHECK_IN_INTERVAL_DAYS - daysSinceScan,
  };
}

export type TodayTaskKind = "check_in" | "routine" | "face_gym";

export interface TodayTask {
  kind: TodayTaskKind;
  /** Row label, shouted in mono caps. Short — it sits beside a tick. */
  label: string;
  /** The line under it. Carries the number, or the roast. */
  detail: string;
  done: boolean;
  href: string;
  /**
   * How this row relates to the face age number — see `MissionLink`. Carried on
   * the task rather than looked up in the component so there's exactly one
   * place that decides what each piece of work is allowed to claim.
   */
  link: MissionLink;
  /**
   * Set when the row can be ticked where it stands instead of opened. Only
   * routines qualify; everything else needs the screen it points at.
   */
  routineId?: string;
  /** The one row that gets the loud treatment. At most one per board. */
  urgent?: boolean;
}

export interface TodayBoard {
  tasks: TodayTask[];
  /**
   * Days until the next scan is due. Null when one is due now or has never
   * happened — in both of those cases there's a task on the board saying so,
   * and a countdown as well would be saying it twice.
   */
  daysUntilCheckIn: number | null;
}

/**
 * Everything the home screen asks for today, in the order to do it.
 *
 * The unit is the day, not the scan. With a scan due once every four weeks, a
 * home screen built around scanning has nothing to say on twenty-seven days out
 * of twenty-eight — so what it tracks instead is the routine and the face gym,
 * which are daily, and the scan appears as a row only when it actually comes
 * round.
 */
export function buildTodayBoard({
  lastScanAt,
  lastScanFailed = false,
  routines,
  completedRoutineIds,
  faceGym,
  now = new Date(),
}: {
  lastScanAt: Date | null;
  /** A failed analysis produced no result, so it's treated as no scan — see `getCheckInEligibility`. */
  lastScanFailed?: boolean;
  routines: { id: string; name: string; timeOfDay: "am" | "pm" | "both"; steps: unknown[] }[];
  completedRoutineIds: string[];
  faceGym: FaceGymStats;
  now?: Date;
}): TodayBoard {
  const effectiveLastScanAt = lastScanFailed ? null : lastScanAt;
  const daysSinceScan = effectiveLastScanAt ? differenceInCalendarDays(now, effectiveLastScanAt) : null;
  const scanDue = daysSinceScan === null || daysSinceScan >= CHECK_IN_INTERVAL_DAYS;
  const tasks: TodayTask[] = [];

  if (scanDue) {
    tasks.push({
      kind: "check_in",
      label: daysSinceScan === null ? "Baseline scan" : "Scan due",
      detail:
        daysSinceScan === null
          ? "Sets the face age every number after it is measured against. Under two minutes."
          : `${daysSinceScan} days since your last one — long enough for the work to show up in a new reading.`,
      done: false,
      href: "/check-in",
      link: "measures",
      urgent: true,
    });
  }

  // No row when there's nothing saved yet: this audience won't build one, and
  // an "urgent," never-completable task nagging them to only served as
  // clutter. The generated plan stays reachable via the PrimeMove card and
  // the Routine nav tab, without the board pretending it's a to-do.
  for (const routine of routines) {
    const slot = routine.timeOfDay === "am" ? "morning" : routine.timeOfDay === "pm" ? "evening" : null;
    // The generated routines are called "Morning routine" and "Evening
    // routine", so spelling the slot out again under the label would be the
    // row repeating itself. Manual routines can be called anything, and those
    // do need telling.
    const suffix = slot && !routine.name.toLowerCase().includes(slot) ? ` · ${slot}` : "";
    tasks.push({
      kind: "routine",
      label: routine.name,
      // Deliberately the not-yet-done wording whatever the state: this row
      // ticks optimistically, so the board rewrites the line itself the
      // instant it's tapped rather than waiting for the server to agree.
      detail: `${routine.steps.length} step${routine.steps.length === 1 ? "" : "s"}${suffix}`,
      done: completedRoutineIds.includes(routine.id),
      href: "/routine",
      // Skincare works on pigmentation, texture and the eye area, which is
      // what the face age reading is made of.
      link: "targets",
      routineId: routine.id,
    });
  }

  tasks.push({
    kind: "face_gym",
    label: "Face Gym",
    // The copy lives with the rest of the face gym copy, not here — that file
    // owns the rule about what the roast is allowed to be about.
    detail: getFaceGymRowLine(faceGym),
    done: faceGym.sessionsToday > 0,
    href: "/face-gym",
    // Muscle, not skin. The analysis doesn't grade muscle tone, so this row
    // says so rather than borrowing credit from the number above it.
    link: "unmeasured",
  });

  return {
    tasks,
    daysUntilCheckIn: scanDue ? null : CHECK_IN_INTERVAL_DAYS - (daysSinceScan ?? 0),
  };
}

/**
 * The board's own headline, derived from how much of it is left.
 *
 * Separate from `buildTodayBoard` because the client re-runs it as rows are
 * ticked — the count has to be able to move without another round trip, or the
 * summary sits there contradicting the ticks underneath it.
 *
 * The bodies point at the face age number without claiming a tick moved it.
 * Today's work is the input; the next scan is the readout. Copy that blurs those
 * two is the easiest lie this app could tell, and the one most worth not
 * telling — a user who believes a checkbox lowered their face age will find out
 * otherwise at the next scan, and won't trust the number again.
 */
export function summariseDay(
  doneCount: number,
  total: number,
): { headline: string; body: string } {
  // A guard, not a state you can reach today: `buildTodayBoard` always emits at
  // least the face gym row. It's here so that if a row ever becomes conditional,
  // an empty board reads as empty instead of as a cleared one.
  if (total === 0) return { headline: "Nothing due", body: "Nothing to log today." };

  // The headline always carries the count, so none of these bodies repeat it —
  // "1 of 3" followed by "2 still to go" is the screen talking to itself.
  if (doneCount >= total) {
    return {
      headline: "Day cleared",
      body: "Everything logged. Days like this are what the next scan reads back.",
    };
  }

  if (doneCount === 0) {
    return {
      headline: `${total} to go`,
      // Not "the number above only moves if these do" — that's a causal
      // guarantee we can't make in either direction. See `face-age.ts`.
      body: "Nothing logged yet. Start at the top.",
    };
  }

  return {
    headline: `${doneCount} of ${total}`,
    body:
      total - doneCount === 1
        ? "One left. Finishing is the difference between a streak and a nice try."
        : "Started, not finished. Consistency is the only input that compounds.",
  };
}
