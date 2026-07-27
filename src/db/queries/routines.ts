import { and, eq, desc } from "drizzle-orm";
import type { Database } from "@/db";
import { routines, routineSteps, routineCompletions } from "@/db/schema";
import { computeStreak } from "@/lib/streak";
import { todayLocalDate } from "@/lib/format";

export async function getActiveRoutines(db: Database, userId: string) {
  return db.query.routines.findMany({
    where: and(eq(routines.userId, userId), eq(routines.isActive, true)),
    with: { steps: true },
    orderBy: [desc(routines.createdAt)],
  });
}

export async function createRoutine(
  db: Database,
  userId: string,
  input: {
    name: string;
    timeOfDay: "am" | "pm" | "both";
    steps: { productName: string; category: string }[];
  },
) {
  const [routine] = await db
    .insert(routines)
    .values({ userId, name: input.name, timeOfDay: input.timeOfDay })
    .returning();

  if (input.steps.length) {
    await db.insert(routineSteps).values(
      input.steps.map((step, i) => ({
        routineId: routine.id,
        userId,
        stepOrder: i,
        productName: step.productName,
        category: step.category as
          | "cleanser"
          | "sunscreen"
          | "retinoid"
          | "moisturizer"
          | "treatment"
          | "other",
      })),
    );
  }

  return routine;
}

export type GeneratedRoutineInput = {
  slot: "am" | "pm";
  name: string;
  steps: { productName: string; category: string }[];
};

/**
 * Writes the generated AM/PM plan, one routine per slot.
 *
 * Updates in place when a generated routine for that slot already exists —
 * the routine row (and with it every `routine_completions` row) is reused,
 * only the steps are replaced. Creating fresh routines on each re-plan would
 * be simpler, but it would silently reset the streak every time someone
 * checks in, which is the one number the whole habit loop runs on.
 */
export async function saveGeneratedRoutines(
  db: Database,
  userId: string,
  plans: GeneratedRoutineInput[],
) {
  const existing = await db.query.routines.findMany({
    where: and(eq(routines.userId, userId), eq(routines.source, "generated")),
  });

  const saved = [];
  for (const plan of plans) {
    const match = existing.find((r) => r.timeOfDay === plan.slot);
    let routineId: string;

    if (match) {
      await db
        .update(routines)
        .set({ name: plan.name, isActive: true, updatedAt: new Date() })
        .where(eq(routines.id, match.id));
      await db.delete(routineSteps).where(eq(routineSteps.routineId, match.id));
      routineId = match.id;
    } else {
      const [created] = await db
        .insert(routines)
        .values({ userId, name: plan.name, timeOfDay: plan.slot, source: "generated" })
        .returning();
      routineId = created.id;
    }

    if (plan.steps.length) {
      await db.insert(routineSteps).values(
        plan.steps.map((step, i) => ({
          routineId,
          userId,
          stepOrder: i,
          productName: step.productName,
          category: step.category as (typeof routineSteps.category.enumValues)[number],
        })),
      );
    }

    saved.push(routineId);
  }

  return saved;
}

/** Idempotent per calendar day — relies on the unique (user, routine, date) index. */
export async function logRoutineCompletion(
  db: Database,
  userId: string,
  routineId: string,
  date: string = todayLocalDate(),
) {
  const existing = await db.query.routineCompletions.findFirst({
    where: and(
      eq(routineCompletions.userId, userId),
      eq(routineCompletions.routineId, routineId),
      eq(routineCompletions.completedDate, date),
    ),
  });
  if (existing) return existing;

  const [completion] = await db
    .insert(routineCompletions)
    .values({ userId, routineId, completedDate: date })
    .returning();
  return completion;
}

/**
 * How far back the batched completion read goes. Streaks only ever need an
 * unbroken run ending today, so truncating deep history can't produce a wrong
 * answer for anyone whose streak is shorter than this — and for anyone whose
 * isn't, it understates rather than inventing one.
 */
const COMPLETION_WINDOW_ROWS = 400;

/**
 * Every recent completion the user has, grouped by routine id.
 *
 * One statement for the whole screen, and it replaced a per-routine read that
 * fetched each routine's dates separately. That shape issued a statement per
 * routine, and because the routine list only exists *after* the routines have
 * loaded, the whole batch landed as a second serial round trip to D1 — on a
 * phone, the difference between one hop and two before anything could render.
 *
 * Keyed by routine id rather than returning flat rows so callers don't each
 * reinvent the grouping; pair it with `deriveRoutineProgress`.
 */
export async function getCompletionsByRoutine(db: Database, userId: string) {
  const rows = await db.query.routineCompletions.findMany({
    where: eq(routineCompletions.userId, userId),
    columns: { routineId: true, completedDate: true },
    orderBy: [desc(routineCompletions.completedDate)],
    limit: COMPLETION_WINDOW_ROWS,
  });

  const byRoutine = new Map<string, string[]>();
  for (const row of rows) {
    const dates = byRoutine.get(row.routineId);
    if (dates) dates.push(row.completedDate);
    else byRoutine.set(row.routineId, [row.completedDate]);
  }
  return byRoutine;
}

/**
 * Streak and today's state for each routine, from one batched read.
 *
 * `today` is threaded through rather than re-derived per routine so every
 * routine on a screen is judged against the same calendar day — a page that
 * renders across midnight would otherwise report two different todays.
 */
export function deriveRoutineProgress(
  completions: Map<string, string[]>,
  routineId: string,
  today: string = todayLocalDate(),
): { streak: number; doneToday: boolean } {
  const dates = completions.get(routineId) ?? [];
  return {
    streak: computeStreak(dates, today),
    doneToday: dates.includes(today),
  };
}
