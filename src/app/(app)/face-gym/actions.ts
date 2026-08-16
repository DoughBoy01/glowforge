"use server";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { getFaceGymStats, logFaceGymSession, type FaceGymStats } from "@/db/queries/face-gym";
import { getFaceGymSessionVerdict, type CoachVerdict } from "@/lib/face-gym-coach";
import { FACE_GYM_EXERCISES, FACE_GYM_ROUND_SECONDS } from "@/lib/face-gym";
import { captureServerEvent } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

/** Sanity ceiling on the client's self-reported active time: the longest a
 *  session could honestly take if every round were replayed a few times. */
const MAX_ACTIVE_SECONDS = FACE_GYM_EXERCISES.length * FACE_GYM_ROUND_SECONDS * 10;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LogFaceGymSessionResult {
  stats: FaceGymStats;
  verdict: CoachVerdict;
}

/**
 * Writes a finished session and hands back the coach's reaction.
 *
 * The counts come from the player, which is the only thing that knows what
 * actually happened in the browser — so they're clamped to what the manifest
 * makes possible before they're stored. Worst case someone hand-crafts a
 * session they didn't do; the blast radius is their own streak number, and
 * paying for a server-side clock to prevent that would cost more than the
 * number is worth.
 */
export async function logFaceGymSessionAction(input: {
  sessionId: string;
  roundsCompleted: number;
  activeSeconds: number;
}): Promise<LogFaceGymSessionResult | null> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  if (!UUID.test(input.sessionId)) return null;

  const roundsTotal = FACE_GYM_EXERCISES.length;
  const roundsCompleted = clamp(input.roundsCompleted, 0, roundsTotal);
  const activeSeconds = clamp(input.activeSeconds, 0, MAX_ACTIVE_SECONDS);

  const db = getDb();
  await logFaceGymSession(db, userId, {
    sessionId: input.sessionId,
    roundsCompleted,
    roundsTotal,
    activeSeconds,
  });

  const stats = await getFaceGymStats(db, userId);

  captureServerEvent({
    distinctId: userId,
    event: ANALYTICS_EVENTS.FACE_GYM_SESSION_COMPLETED,
    properties: {
      roundsCompleted,
      roundsTotal,
      activeSeconds,
      streak: stats.streak,
      totalSessions: stats.totalSessions,
      sessionsToday: stats.sessionsToday,
    },
  });

  // The coach strip at the top of the page is rendered from the log, so it's
  // stale the second a session lands. The overlay uses the stats returned
  // below immediately; this is what makes the next visit agree with it.
  revalidatePath("/face-gym");

  return {
    stats,
    verdict: getFaceGymSessionVerdict(stats, { roundsCompleted, roundsTotal }),
  };
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
