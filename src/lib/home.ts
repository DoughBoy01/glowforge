import { differenceInCalendarDays } from "date-fns";

/**
 * How often a check-in is expected. Frequent enough that the trend line has
 * something to say, far enough apart that skin has actually had time to
 * change between scans.
 */
export const CHECK_IN_INTERVAL_DAYS = 7;

export type NextActionKind = "check_in" | "build_routine" | "log_routine" | "on_track";

export interface NextAction {
  kind: NextActionKind;
  /** Imperative and short — this is the single thing the home screen asks for. */
  title: string;
  body: string;
  href: string;
  cta: string;
}

/**
 * The one thing to do next, picked in priority order.
 *
 * A phone home screen can't be a wall of readouts the way a desktop
 * dashboard can — there's room for roughly one instruction above the fold,
 * so this decides which instruction that is instead of showing four cards
 * and leaving the user to work out which matters.
 */
export function getNextAction({
  lastScanAt,
  routineCount,
  routinesLoggedToday,
  now = new Date(),
}: {
  lastScanAt: Date | null;
  routineCount: number;
  routinesLoggedToday: number;
  now?: Date;
}): NextAction {
  const daysSinceScan = lastScanAt ? differenceInCalendarDays(now, lastScanAt) : null;

  if (daysSinceScan === null || daysSinceScan >= CHECK_IN_INTERVAL_DAYS) {
    return {
      kind: "check_in",
      title: "Time for a check-in",
      body:
        daysSinceScan === null
          ? "Log your baseline to start the trend. Takes under two minutes."
          : `${daysSinceScan} days since your last scan. Two minutes gets you a fresh score.`,
      href: "/check-in",
      cta: "Start check-in",
    };
  }

  if (routineCount === 0) {
    // Framed as collecting something already written rather than a setup
    // task. The plan is generated from their scan the moment they have one,
    // so asking them to "build" a routine would be asking for work we've
    // already done.
    return {
      kind: "build_routine",
      title: "Your routine is ready",
      body: "We wrote it from your last check-in — morning and evening, in order. One tap to start it.",
      href: "/routine",
      cta: "See my routine",
    };
  }

  if (routinesLoggedToday < routineCount) {
    const remaining = routineCount - routinesLoggedToday;
    return {
      kind: "log_routine",
      title: "Log today's routine",
      body:
        routineCount === 1
          ? "Tick today off to keep your streak alive."
          : `${remaining} of ${routineCount} routines still to log today.`,
      href: "/routine",
      cta: "Go to routine",
    };
  }

  const daysUntilCheckIn = Math.max(1, CHECK_IN_INTERVAL_DAYS - (daysSinceScan ?? 0));
  return {
    kind: "on_track",
    title: "You're on track",
    body: `Routine logged. Next check-in due in ${daysUntilCheckIn} day${
      daysUntilCheckIn === 1 ? "" : "s"
    }.`,
    href: "/scans",
    cta: "View progress",
  };
}
