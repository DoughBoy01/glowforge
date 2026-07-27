import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Flame, Plus, ScanFace } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
  BottomSheetDescription,
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogCompletionButton } from "@/components/app/log-completion-button";
import { DailyRoutinePlan } from "@/components/app/daily-routine";
import { SaveRoutineButton } from "@/components/app/save-routine-button";
import { getDb } from "@/db";
import {
  getActiveRoutines,
  getCompletionsByRoutine,
  deriveRoutineProgress,
} from "@/db/queries/routines";
import { getRoutinePlan } from "@/lib/routine-plan";
import { FACE_AGE_LABEL } from "@/lib/face-age";
import { todayLocalDate, formatShortDate } from "@/lib/format";
import { createRoutineAction } from "./actions";

export const metadata = { title: "Routine" };

const CATEGORIES = ["cleanser", "sunscreen", "retinoid", "moisturizer", "treatment", "other"];

const TIME_LABEL: Record<string, string> = {
  am: "Morning",
  pm: "Evening",
  both: "AM & PM",
};

export default async function RoutinePage() {
  const { userId } = await auth();
  const db = getDb();
  // All three in one batch. The streaks and today's state used to be fetched per
  // routine *after* the routine list arrived — two statements each, in a second
  // serial round trip — which on a phone meant nothing rendered until both hops
  // had finished.
  const [routines, plan, completions] = await Promise.all([
    getActiveRoutines(db, userId!),
    getRoutinePlan(db, userId!),
    getCompletionsByRoutine(db, userId!),
  ]);
  const today = todayLocalDate();

  const routineDetails = routines.map((routine) => ({
    routine,
    ...deriveRoutineProgress(completions, routine.id, today),
  }));

  const hasGenerated = routines.some((r) => r.source === "generated");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 md:gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Routine</h1>
          {/* Says what the screen is in service of. Skincare acts on
              pigmentation, texture and the eye area, which is exactly what the
              scan grades — so this is a claim the measurement supports. */}
          <p className="text-sm text-muted-foreground">
            The daily work behind your {FACE_AGE_LABEL.toLowerCase()}.
          </p>
        </div>
        <BottomSheet>
          {/* Secondary on purpose: the plan below is already built, and the
              manual builder is the escape hatch for someone who wants to
              track their own products, not the front door. */}
          <BottomSheetTrigger
            render={
              <Button variant={routines.length ? "outline" : "ghost"}>
                <Plus className="size-4" /> New routine
              </Button>
            }
          />
          <BottomSheetContent>
            <BottomSheetHeader>
              <BottomSheetTitle>New routine</BottomSheetTitle>
              <BottomSheetDescription>
                Add up to five steps. Leave a row blank to skip it.
              </BottomSheetDescription>
            </BottomSheetHeader>
            <form action={createRoutineAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Routine name</Label>
                <Input id="name" name="name" placeholder="Morning routine" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="timeOfDay">Time of day</Label>
                <Select name="timeOfDay" defaultValue="both">
                  <SelectTrigger id="timeOfDay">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="am">AM</SelectItem>
                    <SelectItem value="pm">PM</SelectItem>
                    <SelectItem value="both">AM &amp; PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  // Stacked on a phone: a name field squeezed next to a
                  // category select leaves neither usable at thumb width.
                  <div key={i} className="flex flex-col gap-2 sm:flex-row">
                    <Input name="productName" placeholder={`Step ${i + 1} — product name`} />
                    <Select name="category" defaultValue="other">
                      <SelectTrigger className="w-full sm:w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button type="submit" size="lg" className="w-full sm:w-auto sm:self-end">
                Create routine
              </Button>
            </form>
          </BottomSheetContent>
        </BottomSheet>
      </div>

      {/* Nobody arrives here wanting to design a skincare routine. If we have
          scores, the plan is already written — this page's job is to hand it
          over, not to hand over an empty form. */}
      {routineDetails.length === 0 && plan && (
        <DailyRoutinePlan
          routines={plan.routines}
          scanId={plan.scanId}
          description={`We built this from your ${formatShortDate(plan.capturedAt)} check-in — ordered the way you actually run it. Save it and we'll track it for you.`}
        />
      )}

      {routineDetails.length === 0 && !plan && (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ScanFace className="size-8 text-muted-foreground" />
            <div className="font-semibold">No routine yet — and no scan to build one from</div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Check in once and we&apos;ll write the routine for you: morning and evening, in order,
              based on your own scores.
            </p>
            <Button render={<Link href="/check-in">Start check-in</Link>} />
          </CardContent>
        </Card>
      )}

      {routineDetails.map(({ routine, streak, doneToday }) => (
        <Card key={routine.id} className="border-border/60">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate">{routine.name}</CardTitle>
              <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{TIME_LABEL[routine.timeOfDay] ?? routine.timeOfDay}</Badge>
                {routine.source === "generated" && (
                  <Badge variant="outline">Built for you</Badge>
                )}
                <span className="flex items-center gap-1 font-mono text-xs">
                  <Flame className="size-3.5 text-primary" /> {streak} day streak
                </span>
              </CardDescription>
            </div>
            {/* On a phone the day's one action belongs at the bottom of the
                card, full width and in the thumb zone — not tucked into a
                corner of the header. */}
            <div className="hidden sm:block">
              <LogCompletionButton routineId={routine.id} doneToday={doneToday} />
            </div>
          </CardHeader>
          {routine.steps.length > 0 && (
            <CardContent>
              <ol className="flex flex-col gap-2 text-sm text-muted-foreground sm:gap-1">
                {routine.steps
                  .sort((a, b) => a.stepOrder - b.stepOrder)
                  .map((step) => (
                    <li key={step.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground/60 tabular-nums">
                        {step.stepOrder + 1}.
                      </span>
                      {step.productName}
                      <Badge variant="outline" className="text-xs">
                        {step.category}
                      </Badge>
                    </li>
                  ))}
              </ol>
            </CardContent>
          )}
          <CardContent className="sm:hidden">
            <LogCompletionButton routineId={routine.id} doneToday={doneToday} fullWidth />
          </CardContent>
        </Card>
      ))}

      {/* Scores move, so the plan should too. Re-saving rewrites the steps on
          the same routine rows, which is what keeps the streak intact. */}
      {routineDetails.length > 0 && plan && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">
              {hasGenerated ? "Re-plan from your latest check-in" : "Want one built for you?"}
            </CardTitle>
            <CardDescription>
              {hasGenerated
                ? `Your ${formatShortDate(plan.capturedAt)} scores may have moved the plan. Updating rewrites the steps and keeps your streak.`
                : `We can write a morning and evening routine from your ${formatShortDate(plan.capturedAt)} check-in. Your own routines stay exactly as they are.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <SaveRoutineButton
                scanId={plan.scanId}
                label={hasGenerated ? "Update my routine" : "Build my routine"}
                className="w-full sm:w-auto"
              />
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                render={<Link href={`/scans/${plan.scanId}`}>See the full plan</Link>}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
