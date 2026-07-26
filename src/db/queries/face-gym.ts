import { count, desc, eq } from "drizzle-orm";
import { differenceInCalendarDays, parseISO, subDays, format } from "date-fns";
import type { Database } from "@/db";
import { faceGymSessions } from "@/db/schema";
import { computeStreak } from "@/lib/streak";
import { todayLocalDate } from "@/lib/format";

/**
 * How far back the streak/consistency reads look. Long enough for a monthly
 * habit to be visible, short enough that the query stays a single small page
 * of rows rather than someone's whole history.
 */
const HISTORY_LIMIT = 180;

/** The window "sessions this week" counts over. */
export const FACE_GYM_WEEK_DAYS = 7;

export interface FaceGymStats {
  /** Every session ever, not just the ones in the history window. */
  totalSessions: number;
  /** Consecutive days with at least one session, ending today or yesterday. */
  streak: number;
  /** Longest run of consecutive days on record — the number to beat. */
  bestStreak: number;
  sessionsToday: number;
  sessionsThisWeek: number;
  /** Calendar days since the last session; null if there has never been one. */
  daysSinceLast: number | null;
  lastSessionDate: string | null;
}

export const EMPTY_FACE_GYM_STATS: FaceGymStats = {
  totalSessions: 0,
  streak: 0,
  bestStreak: 0,
  sessionsToday: 0,
  sessionsThisWeek: 0,
  daysSinceLast: null,
  lastSessionDate: null,
};

/**
 * Records a finished workout.
 *
 * `id` is minted by the player when the session starts, which makes the write
 * idempotent without a unique-per-day index: a retry, a double-fire from a
 * re-render, or an offline replay all land on the same row, while two
 * genuinely separate workouts on one day stay two rows. The id only ever
 * collides with the caller's own rows — `userId` comes from the session, not
 * the request body — so a client that sends a duplicate id can at worst
 * discard its own second session.
 */
export async function logFaceGymSession(
  db: Database,
  userId: string,
  input: {
    sessionId: string;
    roundsCompleted: number;
    roundsTotal: number;
    activeSeconds: number;
    date?: string;
  },
) {
  await db
    .insert(faceGymSessions)
    .values({
      id: input.sessionId,
      userId,
      completedDate: input.date ?? todayLocalDate(),
      roundsCompleted: input.roundsCompleted,
      roundsTotal: input.roundsTotal,
      activeSeconds: input.activeSeconds,
    })
    .onConflictDoNothing();
}

/** Longest run of consecutive calendar days in a set of dates (any order). */
function longestRun(dates: string[]): number {
  const unique = Array.from(new Set(dates)).sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < unique.length; i++) {
    const consecutive =
      i > 0 && differenceInCalendarDays(parseISO(unique[i]), parseISO(unique[i - 1])) === 1;
    run = consecutive ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/**
 * The date maths, split out from the query so every number is pinned to one
 * `today` — and so the branch table (lapsed, streaking, twice in a day) can be
 * checked without a database or a calendar.
 *
 * `dates` are session days, newest first; `totalSessions` is the lifetime
 * count, which can exceed `dates.length` once history runs past the window.
 */
export function deriveFaceGymStats(
  dates: string[],
  totalSessions: number,
  today: string = todayLocalDate(),
): FaceGymStats {
  if (dates.length === 0) return EMPTY_FACE_GYM_STATS;

  const weekStart = format(subDays(parseISO(today), FACE_GYM_WEEK_DAYS - 1), "yyyy-MM-dd");
  const lastSessionDate = dates[0];

  return {
    totalSessions,
    streak: computeStreak(dates, today),
    bestStreak: longestRun(dates),
    sessionsToday: dates.filter((d) => d === today).length,
    sessionsThisWeek: dates.filter((d) => d >= weekStart && d <= today).length,
    daysSinceLast: differenceInCalendarDays(parseISO(today), parseISO(lastSessionDate)),
    lastSessionDate,
  };
}

/**
 * Everything the coach copy needs, in two queries: a page of recent sessions
 * for the date maths, and a lifetime count that doesn't depend on the window.
 */
export async function getFaceGymStats(db: Database, userId: string): Promise<FaceGymStats> {
  const [recent, [totals]] = await Promise.all([
    db.query.faceGymSessions.findMany({
      where: eq(faceGymSessions.userId, userId),
      columns: { completedDate: true },
      orderBy: [desc(faceGymSessions.completedDate)],
      limit: HISTORY_LIMIT,
    }),
    db
      .select({ value: count() })
      .from(faceGymSessions)
      .where(eq(faceGymSessions.userId, userId)),
  ]);

  const dates = recent.map((r) => r.completedDate);
  return deriveFaceGymStats(dates, totals?.value ?? dates.length);
}
