import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FACE_AGE_LABEL,
  FACE_AGE_METHODOLOGY,
  getMissionLine,
  type FaceAgeMission,
} from "@/lib/face-age";
import type { CheckInEligibility } from "@/lib/home";
import { formatDate } from "@/lib/format";

/**
 * The Progress tab's state for a user with exactly one check-in ever.
 *
 * Every widget the full page would otherwise render (FaceAgeChart,
 * MetricTrendChart, ConcernTrends, the stat grid) already degrades
 * gracefully to a "not enough data yet" message on one reading — but
 * stacking several of those messages in a row is still a wall of
 * not-yet-relevant chrome. This replaces that wall with the one real thing
 * (the baseline reading), what it becomes once a second check-in lands, and
 * when that opens up.
 *
 * Reuses `getMissionLine` rather than writing new copy, so this can never
 * drift from what `FaceAgeHero`/`BaselineReveal` say about the same
 * reading elsewhere in the app.
 */
export function ProgressFirstScan({
  scanId,
  capturedAt,
  mission,
  eligibility,
}: {
  scanId: string;
  capturedAt: Date;
  mission: FaceAgeMission;
  eligibility: CheckInEligibility;
}) {
  const { headline, body } = getMissionLine(mission);

  return (
    <div className="hud-notch relative mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 overflow-hidden py-20 text-center ring-1 ring-border/60 md:min-h-0 md:py-24">
      <HazardEdge />
      <Kicker>{FACE_AGE_LABEL}</Kicker>

      {mission.current !== null && (
        <span className="animate-glitch-in display block leading-[0.78] tabular-nums text-[clamp(4.5rem,20vw,7rem)]">
          {mission.current}
        </span>
      )}

      <h1 className="display text-2xl leading-[0.95] text-balance md:text-4xl">{headline}</h1>
      <p className="max-w-sm text-sm text-balance text-muted-foreground">{body}</p>
      <p className="max-w-sm text-xs text-balance text-muted-foreground/70">
        {FACE_AGE_METHODOLOGY}
      </p>

      <p className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
        Captured {formatDate(capturedAt)}
      </p>

      <p className="max-w-sm text-sm text-balance text-muted-foreground">
        This becomes your trend line once a second check-in lands — face age over time, how each
        of the four scores is moving, and which concerns are shifting.
      </p>

      {eligibility.eligible ? (
        <p className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
          Next check-in open now
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Next check-in opens {formatDate(eligibility.nextEligibleAt!)} (
          {eligibility.daysRemaining} day{eligibility.daysRemaining === 1 ? "" : "s"} left).
        </p>
      )}

      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button
          size="lg"
          className="w-full sm:w-auto"
          render={
            <Link href={`/scans/${scanId}`}>
              See your full results <ArrowRight className="size-4" />
            </Link>
          }
        />
        {eligibility.eligible && (
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
            render={<Link href="/check-in">New check-in</Link>}
          />
        )}
      </div>
    </div>
  );
}

function HazardEdge() {
  return (
    <span aria-hidden className="hud-hazard pointer-events-none absolute inset-x-0 top-0 h-[3px]" />
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
      <span aria-hidden className="inline-block h-3 w-1 -skew-x-12 bg-accent" />
      {children}
    </p>
  );
}
