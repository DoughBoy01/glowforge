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

export async function getCompletionDates(
  db: Database,
  userId: string,
  routineId: string,
  limit = 120,
) {
  const rows = await db.query.routineCompletions.findMany({
    where: and(
      eq(routineCompletions.userId, userId),
      eq(routineCompletions.routineId, routineId),
    ),
    orderBy: [desc(routineCompletions.completedDate)],
    limit,
  });
  return rows.map((r) => r.completedDate);
}

/**
 * Which routines are already logged today. One query for all of them, so the
 * home screen can decide whether "log your routine" is still the next thing
 * to do without a round trip per routine.
 */
export async function getRoutineIdsCompletedOn(
  db: Database,
  userId: string,
  date: string = todayLocalDate(),
) {
  const rows = await db.query.routineCompletions.findMany({
    where: and(
      eq(routineCompletions.userId, userId),
      eq(routineCompletions.completedDate, date),
    ),
  });
  return rows.map((r) => r.routineId);
}

export async function getRoutineStreak(db: Database, userId: string, routineId: string) {
  const dates = await getCompletionDates(db, userId, routineId);
  return computeStreak(dates);
}
