import { differenceInCalendarDays, parseISO } from "date-fns";
import { todayLocalDate } from "./format";

/**
 * Current streak length from a list of completion dates (YYYY-MM-DD,
 * any order). A streak is unbroken as long as each day has a completion
 * back-to-back from today (or yesterday, so logging later in the day
 * doesn't zero it out).
 *
 * `today` is injectable so callers deriving several date-based numbers at once
 * can pin them all to the same day — and so this is checkable without waiting
 * for the calendar.
 */
export function computeStreak(dates: string[], today: string = todayLocalDate()): number {
  if (dates.length === 0) return 0;

  const unique = Array.from(new Set(dates)).sort().reverse();
  const mostRecentGap = differenceInCalendarDays(
    parseISO(today),
    parseISO(unique[0]),
  );
  if (mostRecentGap > 1) return 0; // streak already broken

  let streak = 1;
  for (let i = 1; i < unique.length; i++) {
    const gap = differenceInCalendarDays(parseISO(unique[i - 1]), parseISO(unique[i]));
    if (gap === 1) streak++;
    else break;
  }
  return streak;
}
