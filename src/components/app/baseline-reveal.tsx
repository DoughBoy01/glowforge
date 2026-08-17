import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FACE_AGE_LABEL,
  FACE_AGE_METHODOLOGY,
  getMissionLine,
  type FaceAgeMission,
} from "@/lib/face-age";

/**
 * A first-time-only ceremony: the moment a brand-new user's baseline face
 * age locks in. Shown once, right after their first scan finishes analysing
 * — before the full results page, which would otherwise show a first-timer
 * the exact same dense wall of cards a twentieth scan gets. This screen is
 * deliberately the opposite: one number, one line of stakes, one way
 * forward into the rest of the results.
 *
 * Reuses `getMissionLine` rather than writing new copy, so this can never
 * drift from what `FaceAgeHero` says about the same reading on every visit
 * after this one. No `ScoreLevelBadge`, no `neon` — baseline isn't a win
 * state, it's the line everything after it is measured against.
 */
export function BaselineReveal({
  mission,
  scanId,
}: {
  mission: FaceAgeMission;
  scanId: string;
}) {
  if (mission.current === null) return null;

  const { headline, body } = getMissionLine(mission);

  return (
    <div className="hud-notch relative mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center gap-5 overflow-hidden py-16 text-center ring-1 ring-border/60 md:min-h-0 md:py-20">
      <HazardEdge />
      <Kicker>{FACE_AGE_LABEL}</Kicker>
      {/* `animate-lock-on` rather than `FaceAgeHero`'s `animate-glitch-in` —
          this number is about to glitch-in again in seconds once the CTA
          below lands on the dashboard, and playing the identical animation
          on the identical number twice in one session reads as a glitch, not
          a flourish. Lock-on gives this one-time reveal its own arrival
          gesture: a baseline being acquired, not just displayed. */}
      <span className="animate-lock-on display block leading-[0.78] tabular-nums text-[clamp(5.5rem,26vw,11rem)]">
        {mission.current}
      </span>
      <p className="display text-2xl leading-[0.95] text-balance md:text-4xl">{headline}</p>
      <p className="max-w-sm text-sm text-balance text-muted-foreground">{body}</p>
      <p className="max-w-sm text-xs text-balance text-muted-foreground/70">
        {FACE_AGE_METHODOLOGY}
      </p>
      <Button
        size="lg"
        className="w-full sm:w-auto"
        render={
          <Link href={`/scans/${scanId}`}>
            See what&apos;s driving your number <ArrowRight className="size-4" />
          </Link>
        }
      />
    </div>
  );
}

/** Matches `FaceAgeHero`/`FirstScanPriming` — same panel language at every
 * stage of the mission, from "not yet" through "just landed" to "ongoing". */
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
