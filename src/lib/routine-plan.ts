import type { Database } from "@/db";
import { getScanById, getLatestScan } from "@/db/queries/scans";
import { getCategoryPriorities } from "@/lib/insights";
import { trackedScores } from "@/lib/metrics";
import { buildDailyRoutines, type DailyRoutine } from "@/lib/daily-routine";
import { buildPrimeMove, type PrimeMove } from "@/lib/prime-move";

export interface RoutinePlan {
  scanId: string;
  capturedAt: Date;
  routines: DailyRoutine[];
  /** The one-move version of the same plan, for anyone the full one loses. */
  primeMove: PrimeMove | null;
}

/**
 * The generated plan for one scan, resolved from the database.
 *
 * Shared by the results page, the routine page, and the save action rather
 * than each rebuilding it from its own query — the action in particular
 * must never take the plan from the client, since the steps it writes are
 * derived from scores only the server can see.
 */
export async function getRoutinePlan(
  db: Database,
  userId: string,
  scanId?: string,
): Promise<RoutinePlan | null> {
  const scan = scanId ? await getScanById(db, userId, scanId) : await getLatestScan(db, userId);
  if (!scan) return null;

  const scores = trackedScores(scan.metricScores);
  if (!scores) return null;

  const priorities = getCategoryPriorities(scores);
  const concernScores = scan.analysis?.concernScores ?? [];
  const routines = buildDailyRoutines(priorities, concernScores);
  if (routines.length === 0) return null;

  return {
    scanId: scan.id,
    capturedAt: scan.capturedAt,
    routines,
    primeMove: buildPrimeMove(priorities, concernScores),
  };
}

/** Flattens a plan into the shape `saveGeneratedRoutines` persists. */
export function planToRoutineInput(routines: DailyRoutine[]) {
  return routines.map((routine) => ({
    slot: routine.slot,
    name: routine.name,
    steps: routine.steps.map((step) => ({
      productName: step.name,
      category: step.category,
    })),
  }));
}
