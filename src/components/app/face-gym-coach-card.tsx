import { Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { FaceGymStats } from "@/db/queries/face-gym";
import { getFaceGymCoachLine, type CoachTone } from "@/lib/face-gym-coach";
import { cn } from "@/lib/utils";

/** Cold and roast read as a warning; warm and hot as the brand colour. */
const TONE_ACCENT: Record<CoachTone, string> = {
  cold: "text-muted-foreground",
  roast: "text-destructive",
  nudge: "text-accent",
  warm: "text-primary",
  hot: "text-primary",
};

/**
 * The state of the habit, in the user's face before they press play. It's
 * deliberately the first thing on the screen: the session itself is only three
 * minutes, so the number that changes behaviour is how many days it's been —
 * not anything inside the workout.
 */
export function FaceGymCoachCard({ stats }: { stats: FaceGymStats }) {
  const line = getFaceGymCoachLine(stats);
  const isFirstTime = stats.totalSessions === 0;

  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={cn(
                "font-mono text-xs font-bold tracking-[0.14em] uppercase",
                TONE_ACCENT[line.tone],
              )}
            >
              {line.headline}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{line.body}</p>
          </div>
          {/* The streak only earns its space once there is one — a "0" next to
              a flame on someone's first visit is just a scolding for arriving. */}
          {stats.streak > 0 && (
            <span className="flex shrink-0 items-center gap-1 font-mono text-sm font-bold tabular-nums text-primary">
              <Flame className="size-4" />
              {stats.streak}
            </span>
          )}
        </div>

        {!isFirstTime && (
          <dl className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs tabular-nums text-muted-foreground">
            <div className="flex gap-1.5">
              <dt className="uppercase tracking-[0.1em]">Total</dt>
              <dd className="font-bold text-foreground">{stats.totalSessions}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="uppercase tracking-[0.1em]">7d</dt>
              <dd className="font-bold text-foreground">{stats.sessionsThisWeek}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="uppercase tracking-[0.1em]">Best</dt>
              <dd className="font-bold text-foreground">{stats.bestStreak}d</dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
