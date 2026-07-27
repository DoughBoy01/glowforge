"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Dumbbell,
  ListChecks,
  Loader2,
  ScanFace,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { logCompletionAction } from "@/app/(app)/routine/actions";
import { summariseDay, type TodayBoard, type TodayTask, type TodayTaskKind } from "@/lib/home";
import { MISSION_LINK_COPY } from "@/lib/face-age";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const ICONS: Record<TodayTaskKind, LucideIcon> = {
  check_in: ScanFace,
  build_routine: Sparkles,
  routine: ListChecks,
  face_gym: Dumbbell,
};

/**
 * The home screen's centrepiece: everything today asks for, in one card, with
 * the routines tickable where they stand.
 *
 * The interactivity is the point rather than decoration. Logging a routine used
 * to mean Home → Routine → find the card → tap → come back, which is four taps
 * of overhead on a one-tap action, and the number of people who bother drops
 * with every one of them. Here it's a tick in place: optimistic, so the row and
 * the count above it move on the same frame as the finger, with the server
 * catching up behind.
 */
export function TodayBoard({
  board,
  className,
}: {
  board: TodayBoard;
  className?: string;
}) {
  const { tasks, daysUntilCheckIn } = board;

  // Optimism is held as a list of ids rather than a patched copy of `tasks`:
  // when the action lands and the page revalidates, the server's own `done`
  // flags take over and this layer collapses to a no-op.
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [loggedIds, addLoggedId] = React.useOptimistic(
    tasks.filter((t) => t.done && t.routineId).map((t) => t.routineId!),
    (state: string[], id: string) => (state.includes(id) ? state : [...state, id]),
  );

  const isDone = (task: TodayTask) =>
    task.done || (task.routineId ? loggedIds.includes(task.routineId) : false);

  const doneCount = tasks.filter(isDone).length;
  const summary = summariseDay(doneCount, tasks.length);
  const allDone = doneCount >= tasks.length && tasks.length > 0;

  function log(routineId: string) {
    haptic("success");
    setPendingId(routineId);
    React.startTransition(async () => {
      addLoggedId(routineId);
      try {
        await logCompletionAction(routineId);
      } finally {
        // Cleared either way: a failed write drops the optimistic tick when the
        // transition ends, and a spinner left behind on a row that has quietly
        // reverted is worse than no spinner at all.
        setPendingId(null);
      }
    });
  }

  return (
    <Card className={cn("border-border/60", className)}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p
              className={cn(
                "font-mono text-[0.625rem] font-bold tracking-[0.16em] uppercase",
                allDone ? "text-primary" : "text-muted-foreground",
              )}
            >
              Today&apos;s work
            </p>
            <p
              className={cn(
                "font-heading text-lg leading-tight",
                allDone && "text-primary dark:[text-shadow:0_0_16px_rgba(255,46,136,.55)]",
              )}
            >
              {summary.headline}
            </p>
          </div>

          {/* One skewed segment per task, echoing the brand block. Reads as a
              progress bar without pretending to a precision it hasn't got. */}
          <div aria-hidden className="mt-1 flex shrink-0 gap-1">
            {tasks.map((task, i) => (
              <span
                key={`${task.kind}-${task.routineId ?? i}`}
                className={cn(
                  "h-4 w-2 -skew-x-12 rounded-[2px] transition-colors duration-300",
                  isDone(task)
                    ? "bg-primary dark:shadow-[0_0_8px_var(--primary)]"
                    : "bg-muted",
                )}
              />
            ))}
          </div>
        </div>

        <p className="text-sm text-balance text-muted-foreground">{summary.body}</p>

        <ul className="flex flex-col divide-y divide-border/60">
          {tasks.map((task, i) => (
            <Row
              key={`${task.kind}-${task.routineId ?? i}`}
              task={task}
              done={isDone(task)}
              pending={task.routineId != null && pendingId === task.routineId}
              onLog={log}
            />
          ))}
        </ul>

        {/* The scan's whole presence on this screen while it isn't due: one
            quiet line, and a way in for anyone who wants it early anyway. */}
        {daysUntilCheckIn !== null && (
          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
            <p className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase tabular-nums">
              Next scan in {daysUntilCheckIn} day{daysUntilCheckIn === 1 ? "" : "s"}
            </p>
            <Link
              href="/check-in"
              className="press-sm rounded-md font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase underline decoration-dotted underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Scan early
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  task,
  done,
  pending,
  onLog,
}: {
  task: TodayTask;
  done: boolean;
  pending: boolean;
  onLog: (routineId: string) => void;
}) {
  const Icon = ICONS[task.kind];
  const tickable = task.routineId != null;

  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className={cn(
          "flex size-9 shrink-0 -skew-x-6 items-center justify-center rounded-md transition-colors",
          done
            ? "bg-muted text-muted-foreground"
            : task.urgent
              ? "bg-primary text-primary-foreground dark:shadow-[2px_2px_0] dark:shadow-accent/50"
              : "bg-muted text-foreground",
        )}
      >
        <Icon className="size-4 skew-x-6" strokeWidth={2.1} />
      </span>

      <Link
        href={task.href}
        className="press-sm min-w-0 flex-1 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "truncate font-mono text-xs font-bold tracking-[0.12em] uppercase",
              done ? "text-muted-foreground line-through decoration-1" : "text-foreground",
              !done && task.urgent && "text-primary",
            )}
          >
            {task.label}
          </span>
          {/* Only shown where it isn't the obvious answer. "Moves the number" on
              every skincare row would be three rows of noise; the two worth
              saying out loud are the scan, which is the only thing that writes a
              new face age, and the gym, which the reading can't see at all. */}
          {task.link !== "targets" && (
            <span
              className={cn(
                "shrink-0 font-mono text-[0.5625rem] font-bold tracking-[0.14em] whitespace-nowrap uppercase",
                task.link === "measures" && !done
                  ? "text-primary"
                  : "text-muted-foreground/70",
              )}
            >
              {MISSION_LINK_COPY[task.link]}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {/* Ticked routines are rewritten here rather than on the server, so
              the line agrees with the tick before the round trip finishes. */}
          {done && tickable ? "Logged today." : task.detail}
        </span>
      </Link>

      {tickable ? (
        <button
          type="button"
          disabled={done || pending}
          onClick={() => onLog(task.routineId!)}
          aria-label={done ? `${task.label} logged today` : `Log ${task.label}`}
          className={cn(
            "press flex size-11 shrink-0 items-center justify-center rounded-lg outline-none",
            "focus-visible:ring-3 focus-visible:ring-ring/50",
            done ? "text-primary" : "text-muted-foreground active:bg-muted/50",
          )}
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-md border-2 transition-colors",
                done
                  ? "border-primary bg-primary text-primary-foreground dark:shadow-[0_0_10px_var(--primary)]"
                  : "border-border",
              )}
            >
              {done && <Check className="size-4" strokeWidth={3} />}
            </span>
          )}
        </button>
      ) : (
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      )}
    </li>
  );
}
