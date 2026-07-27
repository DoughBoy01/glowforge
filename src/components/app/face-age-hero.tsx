import Link from "next/link";
import { ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  FACE_AGE_LABEL,
  getMissionLine,
  years,
  type FaceAgeMission,
} from "@/lib/face-age";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The mission, at the top of the home screen and bigger than anything else on
 * it.
 *
 * This used to be one grey line reading "Skin age 37" tucked under the overall
 * score ring, which had the hierarchy backwards: the four metric scores are
 * diagnostics — they say *which* thing is aging the face — and a 0-100 composite
 * of them is a number with no natural target. Face age has one. It's in years,
 * everyone already knows which direction is good, and it's the only readout here
 * that answers "is this working?" without needing a legend.
 *
 * A server component on purpose. It's the first thing painted on a phone, it
 * has no state, and shipping a client bundle to render a number the server
 * already knows would only delay it.
 */
export function FaceAgeHero({
  mission,
  className,
}: {
  mission: FaceAgeMission;
  className?: string;
}) {
  const { headline, body } = getMissionLine(mission);
  const { current, baseline, best, lastMove, state, atBest } = mission;

  // "Winning" is strictly below baseline. Level isn't a win — it's a month of
  // work with nothing banked, and colouring it like a win would be flattery.
  const ahead = state === "ahead";
  const Trend = state === "ahead" ? TrendingDown : state === "behind" ? TrendingUp : Minus;

  if (current === null) {
    return (
      <Card
        className={cn(
          "-mx-4 rounded-none ring-0 [--card-spacing:--spacing(6)] md:mx-0 md:rounded-xl md:ring-1",
          className,
        )}
      >
        <CardContent className="flex flex-col gap-3">
          <p className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
            {FACE_AGE_LABEL}
          </p>
          <p className="font-heading text-3xl leading-none">{headline}</p>
          <p className="text-sm text-balance text-muted-foreground">{body}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Link
      href="/scans"
      aria-label={`${FACE_AGE_LABEL} ${current}. ${headline}. View full history.`}
      className="block outline-none md:rounded-xl md:focus-visible:ring-3 md:focus-visible:ring-ring/50"
    >
      {/* Full-bleed band on a phone: this is the top of the first screen, and
          insetting it by a gutter spends width the number wants. */}
      <Card
        className={cn(
          "press -mx-4 h-full rounded-none ring-0 [--card-spacing:--spacing(6)] md:mx-0 md:rounded-xl md:ring-1",
          ahead && "md:border-primary/40",
          className,
        )}
      >
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
              {FACE_AGE_LABEL}
            </p>
            {atBest && mission.readings > 1 && (
              <span className="-skew-x-6 bg-primary px-2 py-0.5 font-mono text-[0.625rem] font-bold tracking-[0.16em] text-primary-foreground uppercase dark:shadow-[2px_2px_0] dark:shadow-accent/50">
                <span className="inline-block skew-x-6">Your record</span>
              </span>
            )}
          </div>

          {/* The number and the verdict share a baseline, so the eye lands on
              the years and reads the direction without moving. */}
          <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
            <span
              className={cn(
                "font-mono text-7xl leading-none font-bold tabular-nums",
                ahead && "text-primary dark:[text-shadow:0_0_24px_rgba(255,46,136,.65)]",
              )}
            >
              {current}
            </span>
            <div className="flex min-w-0 flex-col gap-1 pb-1">
              <span
                className={cn(
                  "flex items-center gap-1.5 font-mono text-xs font-bold tracking-[0.14em] uppercase",
                  ahead ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Trend className="size-4 shrink-0" strokeWidth={2.4} />
                {headline}
              </span>
              {lastMove !== null && (
                <span className="font-mono text-[0.625rem] font-bold tracking-[0.14em] text-muted-foreground uppercase tabular-nums">
                  {lastMove === 0
                    ? "No change last scan"
                    : `${lastMove < 0 ? "−" : "+"}${years(lastMove)} last scan`}
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-balance text-muted-foreground">{body}</p>

          {/* Baseline and record, the two numbers that give the big one a scale.
              Hidden entirely on a single reading, where both would just be the
              same number repeated back three times. */}
          {baseline !== null && mission.readings > 1 && (
            <dl className="flex items-stretch gap-3 border-t border-border/60 pt-4">
              <Stat label="Baseline" value={baseline} footer="where you started" />
              {best && (
                <Stat
                  label="Record"
                  value={best.faceAge}
                  footer={formatShortDate(best.capturedAt)}
                  lit={atBest}
                />
              )}
            </dl>
          )}

          <span className="flex items-center gap-1 font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
            Full history <ChevronRight className="size-3.5" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

function Stat({
  label,
  value,
  footer,
  lit = false,
}: {
  label: string;
  value: number;
  footer: string;
  lit?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <dt className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "font-mono text-xl leading-none font-bold tabular-nums",
          lit && "text-primary",
        )}
      >
        {value}
      </dd>
      <span className="truncate text-xs text-muted-foreground">{footer}</span>
    </div>
  );
}
