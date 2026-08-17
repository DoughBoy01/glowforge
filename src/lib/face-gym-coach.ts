import type { FaceGymStats } from "@/db/queries/face-gym";

/**
 * Face Gym coach — turns the session log into something with an opinion.
 *
 * Two rules run through all of this copy, and they're the reason it lives in
 * one file rather than being sprinkled through the JSX:
 *
 * 1. **It roasts the habit, never the face.** "You've skipped a fortnight" is
 *    fair game; anything about how someone looks is not. This is an app people
 *    open because they're self-conscious about their appearance — punching at
 *    that to drive engagement would be indefensible, and it's the one line
 *    that must not move when someone asks for the copy to be spicier.
 * 2. **The claim is always the log, never the result.** We can say they turned
 *    up eleven times. We can't say their jawline improved, because nothing
 *    here measures that.
 */

export type CoachTone = "cold" | "roast" | "nudge" | "warm" | "hot";

export interface CoachLine {
  tone: CoachTone;
  /** Short, shouted in mono caps by the UI — three or four words. */
  headline: string;
  /** One sentence under it. Carries the actual number. */
  body: string;
}

/** Streak lengths worth calling out by name. Descending — first hit wins. */
const MILESTONES = [100, 60, 30, 21, 14, 7, 3] as const;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * The state-of-the-habit line, shown above the player every time the screen
 * loads. Ordered coldest-first: how long they've been away outranks how good
 * their streak used to be, because the streak they *had* is exactly what a
 * lapsed user needs pointing at.
 */
export function getFaceGymCoachLine(stats: FaceGymStats): CoachLine {
  const { totalSessions, streak, bestStreak, sessionsToday, daysSinceLast } = stats;

  if (totalSessions === 0 || daysSinceLast === null) {
    return {
      tone: "cold",
      headline: "43 muscles, 0 sessions",
      body: "You have never trained a single one of them. Three minutes fixes that.",
    };
  }

  if (daysSinceLast >= 30) {
    return {
      tone: "roast",
      headline: `${daysSinceLast} days off`,
      body: `A month. You'd have noticed if you'd skipped leg day this long — and that's ${plural(
        totalSessions,
        "session",
      )} of yours going to waste.`,
    };
  }

  if (daysSinceLast >= 7) {
    return {
      tone: "roast",
      headline: `${daysSinceLast} days off`,
      body:
        bestStreak >= 3
          ? `You once ran ${plural(bestStreak, "day")} straight. That version of you would be embarrassed.`
          : "A week off a three-minute workout takes real commitment. Wrong kind.",
    };
  }

  if (daysSinceLast >= 2) {
    return {
      tone: "nudge",
      headline: `${daysSinceLast} days since`,
      body:
        streak === 0 && bestStreak >= 3
          ? `Streak's gone — ${plural(bestStreak, "day")} was your best. Start the next one now.`
          : "Not a disaster yet. Two more days and it is.",
    };
  }

  if (sessionsToday > 0) {
    return {
      tone: "hot",
      headline: sessionsToday > 1 ? `${sessionsToday} sessions today` : "Done today",
      body:
        streak > 1
          ? `${plural(streak, "day")} in a row. Come back tomorrow and make it ${streak + 1}.`
          : "Day one of the next streak. The hard part is day two.",
    };
  }

  // Yesterday — the highest-leverage moment there is. Turn up today and the
  // streak survives; don't and it's back to zero.
  return {
    tone: "warm",
    headline: streak > 0 ? `${streak}-day streak` : "Back on it",
    body:
      streak > 0
        ? `Alive until midnight. Three minutes now makes it ${streak + 1}.`
        : "You trained yesterday. Do it again and it starts counting.",
  };
}

/**
 * The one-line version, for surfaces outside the Face Gym screen — currently
 * the home board's row, where there's no headline above it to lean on and no
 * room for two sentences.
 *
 * It exists because `getFaceGymCoachLine`'s bodies are written to sit under a
 * headline that has already said how many days it's been: lift one onto another
 * screen and you get "You have never trained a single one of them", with
 * nothing anywhere near it saying what "them" is. Same two rules as the rest of
 * this file — the number always comes from the log, and the jab is always at the
 * habit.
 */
export function getFaceGymRowLine(stats: FaceGymStats): string {
  const { totalSessions, streak, bestStreak, sessionsToday, daysSinceLast } = stats;

  if (sessionsToday > 0) {
    return streak > 1 ? `Done · ${streak}-day streak.` : "Done today.";
  }

  if (totalSessions === 0 || daysSinceLast === null) {
    return "43 muscles in your face, none of them ever trained. Three minutes.";
  }

  if (daysSinceLast >= 30) {
    return `${daysSinceLast} days off. You'd have noticed skipping leg day this long.`;
  }

  if (daysSinceLast >= 7) {
    return bestStreak >= 3
      ? `${daysSinceLast} days off. You once ran ${bestStreak} straight.`
      : `${daysSinceLast} days off a three-minute workout.`;
  }

  if (daysSinceLast >= 2) {
    return `${daysSinceLast} days off. Two more and there's no habit left to break.`;
  }

  // Trained yesterday, so the streak is alive until midnight — the one state
  // where naming the number is the whole nudge.
  return streak > 0
    ? `${streak}-day streak, alive until midnight. Three minutes.`
    : "Six rounds, a minute each.";
}

export interface CoachVerdict extends CoachLine {
  /** Set when this session landed on a milestone streak day. */
  milestone: number | null;
}

/**
 * What the completion overlay says the moment the last round's clock runs
 * out, given the stats *after* the session was written.
 *
 * Skipped rounds get named. Not to punish anyone — you can always tap Skip —
 * but a workout log that treats six taps and six minutes as the same thing
 * is worth nothing to the person reading it back later.
 */
export function getFaceGymSessionVerdict(
  stats: FaceGymStats,
  session: { roundsCompleted: number; roundsTotal: number },
): CoachVerdict {
  const skipped = Math.max(0, session.roundsTotal - session.roundsCompleted);
  const milestone = MILESTONES.find((m) => stats.streak === m) ?? null;

  if (skipped >= session.roundsTotal) {
    return {
      tone: "roast",
      milestone: null,
      headline: "Technically complete",
      body: "You skipped every round. It's logged, but we both know what happened.",
    };
  }

  if (skipped > 0) {
    return {
      tone: "nudge",
      milestone,
      headline: `${session.roundsCompleted} of ${session.roundsTotal}`,
      body: `${plural(skipped, "round")} skipped. Logged anyway — do the full set tomorrow.`,
    };
  }

  if (milestone) {
    return {
      tone: "hot",
      milestone,
      headline: `${milestone}-day streak`,
      body:
        milestone >= 30
          ? `${milestone} days. At this point it's just who you are.`
          : `${milestone} days straight. Don't be the person who stops at ${milestone}.`,
    };
  }

  if (stats.sessionsToday > 1) {
    return {
      tone: "hot",
      milestone: null,
      headline: `${stats.sessionsToday}× today`,
      body: "Second session in a day. Nobody asked you to do that. Respect.",
    };
  }

  if (stats.streak > 1) {
    return {
      tone: "hot",
      milestone: null,
      headline: `${stats.streak}-day streak`,
      body: `Logged. Tomorrow makes it ${stats.streak + 1}.`,
    };
  }

  return {
    tone: "warm",
    milestone: null,
    headline: "Session logged",
    body:
      stats.totalSessions > 1
        ? `${plural(stats.totalSessions, "session")} on record. Streak starts when you do two days back to back.`
        : "First one done. Come back tomorrow and it becomes a streak.",
  };
}
