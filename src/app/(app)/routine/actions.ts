"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { createRoutine, logRoutineCompletion, saveGeneratedRoutines } from "@/db/queries/routines";
import { getRoutinePlan, planToRoutineInput } from "@/lib/routine-plan";
import { captureServerEvent } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

export async function createRoutineAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const name = String(formData.get("name") ?? "").trim();
  const timeOfDay = String(formData.get("timeOfDay") ?? "both") as "am" | "pm" | "both";
  const productNames = formData.getAll("productName").map(String);
  const categories = formData.getAll("category").map(String);

  if (!name) return;

  const steps = productNames
    .map((productName, i) => ({ productName: productName.trim(), category: categories[i] ?? "other" }))
    .filter((s) => s.productName.length > 0);

  await createRoutine(getDb(), userId, { name, timeOfDay, steps });
  revalidatePath("/routine");
}

/**
 * Saves the AM/PM plan we built from a scan as the user's live routines.
 *
 * The plan is rebuilt here from the scan rather than accepted from the
 * client — the caller only names which scan to plan from, so nothing a
 * browser sends can decide what ends up in someone's routine.
 */
export async function saveGeneratedRoutinesAction(scanId?: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = getDb();
  const plan = await getRoutinePlan(db, userId, scanId);
  if (!plan) return { ok: false as const };

  await saveGeneratedRoutines(db, userId, planToRoutineInput(plan.routines));

  captureServerEvent({
    distinctId: userId,
    event: ANALYTICS_EVENTS.ROUTINE_GENERATED,
    properties: {
      scanId: plan.scanId,
      stepCount: plan.routines.reduce((sum, r) => sum + r.steps.length, 0),
    },
  });

  revalidatePath("/routine");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function logCompletionAction(routineId: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = getDb();
  await logRoutineCompletion(db, userId, routineId);

  captureServerEvent({
    distinctId: userId,
    event: ANALYTICS_EVENTS.ROUTINE_STEP_LOGGED,
    properties: { routineId },
  });

  revalidatePath("/routine");
  revalidatePath("/dashboard");
}
