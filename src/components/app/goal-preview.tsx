"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SIMULATION_BADGE, SIMULATION_DISCLAIMER, PREDICTION_DISCLAIMER } from "@/lib/face-simulation";
import { cn } from "@/lib/utils";

export type SimulationStatus = "pending" | "processing" | "succeeded" | "failed" | "skipped";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40;

export interface GoalPreviewParam {
  label: string;
  intensity: number;
  currentScore: number;
  inFocus: boolean;
}

/**
 * The goal, as a picture: the user's own front photo on one side, the same
 * photo with a realistic amount of improvement rendered on the other, wiped
 * between by a draggable handle.
 *
 * Why a wipe and not two images side by side: at phone width, two 160px faces
 * are too small to read a texture change on, and the difference this shows is
 * deliberately subtle (see the caps in `@/lib/face-simulation`). Overlaying
 * them at full width and letting the user scrub is the only presentation where
 * a 0.3 texture change is actually visible — and scrubbing back to 0% keeps
 * the real photo one gesture away at all times, which matters for a feature
 * whose whole risk is looking like a beauty filter.
 *
 * The handle starts at 55% rather than 50% so the page loads showing slightly
 * more of the goal than the baseline — enough to read as "here's where this
 * goes" without hiding what they actually look like.
 */
/** `null`/pending/processing all mean "not settled yet, keep polling" — mirrors the original single-status guard. */
function isPending(s: SimulationStatus | null): boolean {
  return s === null || s === "pending" || s === "processing";
}

export function GoalPreview({
  scanId,
  status,
  goalLabel,
  summary,
  params,
  horizonWeeks,
  initialPredictionStatus = null,
  initialPredictedSkinAge = null,
  className,
}: {
  scanId: string;
  status: SimulationStatus | null;
  goalLabel: string;
  summary: string;
  params: GoalPreviewParam[];
  horizonWeeks: number;
  initialPredictionStatus?: SimulationStatus | null;
  initialPredictedSkinAge?: number | null;
  className?: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [predictionStatus, setPredictionStatus] = useState(initialPredictionStatus);
  const [predictedSkinAge, setPredictedSkinAge] = useState(initialPredictedSkinAge);
  const [gaveUp, setGaveUp] = useState(false);

  // The simulation is generated after the analysis lands, and the prediction
  // (the same analysis re-run on the simulated image, to grade it) lands
  // after that — this component mounts in a pending state and has to wait
  // both out. Shares the analysis status endpoint rather than adding a
  // second polling loop.
  useEffect(() => {
    if (!isPending(current) && !isPending(predictionStatus)) return;

    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      // Two minutes covers the analysis plus a simulation round trip with
      // room to spare. Past that something upstream died without writing a
      // terminal state, and polling a dead job until the tab closes helps
      // nobody. Only retires the whole card if the goal image itself never
      // landed — once that's up, a prediction that never arrives just means
      // no readout, not an empty card.
      if (attempts++ > MAX_POLL_ATTEMPTS) {
        if (isPending(current)) setGaveUp(true);
        return;
      }
      try {
        const res = await fetch(`/api/scans/${scanId}/analysis`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          simulationStatus: SimulationStatus | null;
          predictionStatus: SimulationStatus | null;
          predictedSkinAge: number | null;
        };
        if (cancelled) return;
        if (data.simulationStatus !== null) {
          setCurrent(data.simulationStatus);
          if (data.simulationStatus === "succeeded") router.refresh();
        }
        if (data.predictionStatus !== null) {
          setPredictionStatus(data.predictionStatus);
          setPredictedSkinAge(data.predictedSkinAge);
        }
      } catch {
        // Transient — the next interval retries.
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [current, predictionStatus, scanId, router]);

  if (gaveUp) return null;

  // A failed goal image is not worth a red banner. The scores, the projection
  // and the routine are all still on the page and all still correct; this was
  // the decoration on top.
  if (current === "failed") return null;

  if (current === "skipped") {
    return (
      <Card className={cn("border-border/60", className)}>
        <CardContent className="flex flex-col gap-2">
          <Label>Your goal</Label>
          <p className="font-heading text-xl leading-tight">Not much left to simulate</p>
          <p className="text-sm text-balance text-muted-foreground">
            Your scores are high enough across the board that a goal image would look the same
            as the photo you just took. That&apos;s the good outcome — the work now is holding
            it.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (current === null || current === "pending" || current === "processing") {
    return (
      <Card className={cn("border-border/60", className)}>
        <CardContent className="flex flex-col gap-4">
          <Label>Your goal</Label>
          <div className="flex aspect-square w-full max-w-sm animate-pulse items-center justify-center self-center rounded-xl bg-muted/60">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Building your goal preview from this scan…
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border/60", className)}>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <Label>Your goal · {goalLabel}</Label>
          <span className="-skew-x-6 bg-primary px-2 py-0.5 font-mono text-[0.625rem] font-bold tracking-[0.16em] text-primary-foreground uppercase">
            <span className="inline-block skew-x-6">{SIMULATION_BADGE}</span>
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="font-heading text-xl leading-tight text-balance">{summary}</p>
          <p className="text-sm text-muted-foreground">
            What ~{horizonWeeks} weeks of consistent routine could plausibly look like.
          </p>
          {/* Mono, not `display` — this supports the page, it isn't the one
              number the screen exists to deliver (that's the real face age
              on the dashboard/results header). */}
          {predictionStatus === "succeeded" && predictedSkinAge !== null && (
            <p className="mt-1 font-mono text-xs tracking-wide text-muted-foreground">
              Projected face age{" "}
              <span className="font-bold text-foreground tabular-nums">{predictedSkinAge}</span>
            </p>
          )}
        </div>

        <RevealSlider scanId={scanId} />

        {params.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
            <Label>What the image changes</Label>
            <ul className="flex flex-col gap-2">
              {params.map((p) => (
                <li key={p.label} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {p.label}
                    {p.inFocus && (
                      <Sparkles
                        className="ml-1.5 inline size-3 text-primary"
                        aria-label="part of your goal"
                      />
                    )}
                  </span>
                  {/* The bar is the applied simulation strength, not a
                      predicted score. Labelling it "strength" keeps it from
                      being read as "your pores will score 34". */}
                  <span
                    className="relative h-1.5 w-24 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`Simulation strength ${Math.round(p.intensity * 100)} percent`}
                  >
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-primary"
                      style={{ width: `${Math.round(p.intensity * 100)}%` }}
                    />
                  </span>
                  <span className="w-9 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {Math.round(p.intensity * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs leading-relaxed text-balance text-muted-foreground">
          {SIMULATION_DISCLAIMER}
          {predictionStatus === "succeeded" && predictedSkinAge !== null && ` ${PREDICTION_DISCLAIMER}`}
        </p>
      </CardContent>
    </Card>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/**
 * Before/after wipe. The "after" image sits underneath at full size and the
 * "before" is clipped to `position`, so dragging left reveals the goal.
 *
 * Implemented as a range input rather than pointer handlers on a div: it gets
 * keyboard control, screen-reader semantics and touch behaviour for free, and
 * the visible handle is just styling over a real control.
 */
function RevealSlider({ scanId }: { scanId: string }) {
  const [position, setPosition] = useState(55);
  const containerRef = useRef<HTMLDivElement>(null);

  const onPointer = useCallback((e: React.PointerEvent) => {
    // Dragging anywhere on the image moves the handle, which is what people
    // try first. The range input still owns the value.
    if (e.buttons !== 1 && e.type !== "pointerdown") return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, pct)));
  }, []);

  return (
    <div className="flex w-full max-w-sm flex-col gap-3 self-center">
      <div
        ref={containerRef}
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        className="relative aspect-square w-full touch-none overflow-hidden rounded-xl ring-1 ring-border/60 select-none"
      >
        {/* Plain <img>: these are authenticated, per-user, single-use images
            behind an API route — nothing next/image's optimizer can cache or
            resize usefully, and routing them through it would only add a hop. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/simulations/${scanId}`}
          alt="Simulated preview of your skin after a consistent routine"
          className="absolute inset-0 size-full object-cover"
          draggable={false}
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/photos/${scanId}/front`}
            alt="Your photo from this check-in"
            className="absolute inset-0 size-full object-cover"
            draggable={false}
          />
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-background/90 shadow-[0_0_8px_rgba(0,0,0,.45)]"
          style={{ left: `${position}%` }}
        >
          <span className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background/90 bg-background/25 backdrop-blur-sm" />
        </div>

        <Corner className="left-2">Now</Corner>
        <Corner className="right-2">Goal</Corner>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        aria-label="Reveal simulated result. 0 shows the simulation, 100 shows your photo."
        className="w-full accent-primary"
      />
    </div>
  );
}

function Corner({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute bottom-2 rounded bg-background/75 px-1.5 py-0.5 font-mono text-[0.625rem] font-bold tracking-[0.14em] uppercase backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}
