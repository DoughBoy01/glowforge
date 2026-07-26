"use client";

import * as React from "react";
import {
  Check,
  Dumbbell,
  Flame,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { logFaceGymSessionAction } from "@/app/(app)/face-gym/actions";
import {
  FACE_GYM_ROUND_SECONDS,
  faceGymVideoSrc,
  formatCountdown,
  type FaceGymExercise,
} from "@/lib/face-gym";
import type { CoachVerdict } from "@/lib/face-gym-coach";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics/client";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** Countdown tick. Well under a second so the clock never visibly stalls. */
const TICK_MS = 200;

/**
 * The Face Gym workout: one video per round, looping, with a one-minute
 * countdown that hands off to the next round when it runs out.
 *
 * The clock is driven by elapsed wall time rather than by counting ticks, so a
 * throttled interval can't silently stretch a minute into ninety seconds. It
 * also stops while the tab is hidden — mobile Safari pauses the video when you
 * background the app, and a timer that kept running would advance rounds
 * nobody was doing.
 */
export function FaceGymSession({ exercises }: { exercises: FaceGymExercise[] }) {
  const [index, setIndex] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  /** Set once the first round starts. Before that the frame is the start gate. */
  const [started, setStarted] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [muted, setMuted] = React.useState(true);
  /** Slugs whose file didn't load, so we can name the one that's missing. */
  const [missing, setMissing] = React.useState<Record<string, true>>({});
  /** The coach's reaction to the session just logged, once the write lands. */
  const [verdict, setVerdict] = React.useState<CoachVerdict | null>(null);
  const [logState, setLogState] = React.useState<"idle" | "saving" | "failed">("idle");

  const [remaining, setRemaining] = React.useState(FACE_GYM_ROUND_SECONDS);
  // Mirrored for the interval, which needs the live value without
  // re-subscribing (and therefore restarting) on every tick.
  const remainingRef = React.useRef(FACE_GYM_ROUND_SECONDS);
  const setRemainingValue = React.useCallback((value: number) => {
    remainingRef.current = value;
    setRemaining(value);
  }, []);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  // The round number, authoritative. `advance` has to read the live value
  // rather than the one its render closed over: two taps of Skip inside one
  // React batch would otherwise both think they were on the same round, and
  // step the index past the end of the list.
  const indexRef = React.useRef(0);
  const exercise = exercises[index];
  const isLast = index === exercises.length - 1;

  // --- The workout log ------------------------------------------------------
  // A "session" is one run at the list, from whenever the user first presses
  // play to the moment the last round's clock runs out. It gets an id up front
  // so the write at the end is idempotent: a retry, a double-fire, or React
  // re-running the effect can't turn one workout into two rows.
  const sessionIdRef = React.useRef<string | null>(null);
  /** Rounds whose minute genuinely ran out. Skipping past one doesn't count. */
  const roundsCompletedRef = React.useRef(0);
  /** Seconds with the clock actually running — paused time isn't training. */
  const activeSecondsRef = React.useRef(0);

  const beginSessionIfNeeded = React.useCallback(() => {
    if (sessionIdRef.current) return;
    sessionIdRef.current = crypto.randomUUID();
    roundsCompletedRef.current = 0;
    activeSecondsRef.current = 0;
    setVerdict(null);
    setLogState("idle");
    track(ANALYTICS_EVENTS.FACE_GYM_SESSION_STARTED, { rounds: exercises.length });
  }, [exercises.length]);

  /** Move to a round and put the clock back to a full minute. */
  const goTo = React.useCallback(
    (next: number) => {
      beginSessionIfNeeded();
      indexRef.current = next;
      setIndex(next);
      setRemainingValue(FACE_GYM_ROUND_SECONDS);
      setStarted(true);
      setDone(false);
      setRunning(true);
    },
    [beginSessionIfNeeded, setRemainingValue],
  );

  /** The clock ran out (or Skip was pressed): next round, or the end. */
  const advance = React.useCallback(() => {
    const next = indexRef.current + 1;
    if (next >= exercises.length) {
      haptic("success");
      setRunning(false);
      setDone(true);
      setRemainingValue(0);

      // End of the run: bank it. Clearing the id here is what makes the next
      // press of play a new session rather than a second write of this one.
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      if (!sessionId) return;

      const payload = {
        sessionId,
        roundsCompleted: roundsCompletedRef.current,
        activeSeconds: Math.round(activeSecondsRef.current),
      };
      setLogState("saving");
      logFaceGymSessionAction(payload)
        .then((result) => {
          if (!result) {
            setLogState("failed");
            return;
          }
          setVerdict(result.verdict);
          setLogState("idle");
        })
        // Offline, or the write failed. The workout still happened, so the
        // overlay falls back to congratulating them without a streak number
        // rather than pretending the session didn't count.
        .catch(() => setLogState("failed"));
      return;
    }
    // Deliberately lighter than the end-of-session buzz — this is a handoff,
    // not a finish, and it fires five times a session.
    haptic("impact");
    indexRef.current = next;
    setIndex(next);
    setRemainingValue(FACE_GYM_ROUND_SECONDS);
  }, [exercises.length, setRemainingValue]);

  React.useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const elapsed = (now - last) / 1000;
      last = now;
      activeSecondsRef.current += elapsed;
      const next = remainingRef.current - elapsed;
      if (next <= 0) {
        setRemainingValue(0);
        // Counted here rather than in `advance`, which Skip also calls — a
        // round only counts when its minute was actually served.
        roundsCompletedRef.current += 1;
        advance();
      } else {
        setRemainingValue(next);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running, advance, setRemainingValue]);

  // Backgrounding the app pauses the video on iOS; pause the round with it.
  React.useEffect(() => {
    const onHidden = () => {
      if (document.hidden) setRunning(false);
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, []);

  // Keep playback in step with the clock.
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!running) {
      video.pause();
      return;
    }
    void video.play().catch((error: unknown) => {
      // Autoplay blocked: the browser wants a gesture, so stopping the round
      // matches what the user is actually looking at. Any other failure is
      // the file's problem (missing, wrong codec) — the workout still runs,
      // because the video is the demo, not the exercise.
      if (error instanceof DOMException && error.name === "NotAllowedError") setRunning(false);
    });
  }, [running, index]);

  /** Take the current round from the top — including the round that just
   *  ended the session, which is the natural "one more" after the buzzer. */
  const restart = () => {
    const video = videoRef.current;
    if (video) video.currentTime = 0;
    beginSessionIfNeeded();
    setRemainingValue(FACE_GYM_ROUND_SECONDS);
    setStarted(true);
    setDone(false);
    setRunning(true);
  };

  // Belt and braces: `FACE_GYM_EXERCISES` is hand-edited, and an empty array
  // shouldn't take the page down with it.
  if (!exercise) return null;

  const progress = 1 - remaining / FACE_GYM_ROUND_SECONDS;
  const videoMissing = !!missing[exercise.slug];

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden border-border/60 p-0">
        {/* 16:9 to match the clips, and letterboxed rather than cropped —
            these are faces, and a clip that arrives in another ratio should
            lose its edges to black, not lose the top of a head. */}
        <div className="relative aspect-video w-full bg-black">
          <video
            // Remounts per round, so switching rounds can't leave the previous
            // clip's buffered frame on screen.
            key={exercise.slug}
            ref={videoRef}
            src={faceGymVideoSrc(exercise.file)}
            className="size-full object-contain"
            loop
            muted={muted}
            playsInline
            preload="auto"
            onError={() => setMissing((prev) => ({ ...prev, [exercise.slug]: true }))}
          />

          {/* Round progress, drawn across the top edge of the frame — the
              numeric clock answers "how long left", this answers it at a
              glance without reading. */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-0.5 origin-left bg-primary transition-[width] duration-200 ease-linear dark:shadow-[0_0_10px_var(--primary)]"
            style={{ width: `${progress * 100}%` }}
          />

          {/* Only while a round is actually live: before the first start and
              after the last one, the overlay below owns the frame, and a
              blurred "1:00" showing through it is just noise. */}
          {started && !done && (
            <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
              <Badge variant="secondary" className="font-mono tabular-nums">
                {index + 1}/{exercises.length}
              </Badge>
              <div className="flex items-center gap-2">
                <span
                  // Hidden from assistive tech on purpose: the round change is
                  // announced by the live region below, and a clock that
                  // announced every tick would be unusable.
                  aria-hidden
                  className={cn(
                    "rounded-md bg-black/55 px-2 py-1 font-mono text-2xl font-bold tabular-nums text-white backdrop-blur-sm",
                    remaining <= 10 && running && "text-primary",
                  )}
                >
                  {formatCountdown(remaining)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMuted((m) => !m);
                    haptic("select");
                  }}
                  className="press flex size-9 items-center justify-center rounded-md bg-black/55 text-white outline-none backdrop-blur-sm focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                  <span className="sr-only">{muted ? "Unmute" : "Mute"}</span>
                </button>
              </div>
            </div>
          )}

          {videoMissing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <Dumbbell className="size-7 text-white/40" />
              <p className="font-mono text-xs font-bold tracking-[0.14em] text-white/70 uppercase">
                Video not added yet
              </p>
              <code className="rounded bg-white/10 px-2 py-1 font-mono text-xs text-white/60">
                public{faceGymVideoSrc(exercise.file)}
              </code>
            </div>
          )}

          {/* Pre-start and post-session, the frame carries the one action
              worth taking rather than sitting there as a black rectangle. */}
          {(!started || done) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45 px-6 text-center backdrop-blur-sm">
              {done ? (
                <>
                  {verdict?.milestone ? (
                    <Flame className="size-8 text-primary" />
                  ) : (
                    <Check className="size-8 text-primary" />
                  )}
                  {/* The verdict replaces the generic line as soon as the write
                      comes back — which is the whole point of logging it. Until
                      then (and if the write fails) the fallback still tells them
                      they finished; the number is what's missing, not the win. */}
                  <p className="font-mono text-sm font-bold tracking-[0.14em] text-white uppercase">
                    {verdict?.headline ?? "Session complete"}
                  </p>
                  <p className="max-w-xs text-sm text-white/70">
                    {verdict?.body ??
                      (logState === "failed"
                        ? `${exercises.length} rounds done. We couldn't save it — check your connection.`
                        : `${exercises.length} rounds, all 43 muscles worked. Same time tomorrow.`)}
                  </p>
                  <Button size="lg" onClick={() => goTo(0)}>
                    <RotateCcw className="size-4" /> Run it again
                  </Button>
                </>
              ) : (
                <>
                  <Button size="lg" onClick={() => goTo(0)}>
                    <Play className="size-4" /> Start session
                  </Button>
                  {/* Round length lives in the header line above, so it isn't
                      repeated here where it could drift out of step with it. */}
                  <p className="max-w-xs text-sm text-white/70">
                    It moves you on automatically.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <CardContent className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">{exercise.name}</h2>
              <Badge variant="outline">{exercise.target}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{exercise.cue}</p>
          </div>

          {/* Pause is the wide one: mid-round it's the only control anyone
              reaches for, and it has to be hittable without looking. */}
          <div className="flex items-center gap-2">
            <Button
              size="lg"
              variant={running ? "secondary" : "default"}
              className="flex-1"
              onClick={() => {
                haptic("select");
                if (done) goTo(0);
                else if (running) setRunning(false);
                else {
                  beginSessionIfNeeded();
                  setStarted(true);
                  setRunning(true);
                }
              }}
            >
              {running ? (
                <>
                  <Pause className="size-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="size-4" /> {done ? "Again" : started ? "Resume" : "Start"}
                </>
              )}
            </Button>
            <Button size="icon-lg" variant="outline" onClick={restart}>
              <RotateCcw className="size-4" />
              <span className="sr-only">Restart this round</span>
            </Button>
            <Button
              size="icon-lg"
              variant="outline"
              disabled={isLast && done}
              onClick={() => {
                haptic("select");
                advance();
              }}
            >
              <SkipForward className="size-4" />
              <span className="sr-only">Skip to next round</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Announced separately from the ticking clock: a round change is worth
          hearing, each second is not. */}
      <p aria-live="polite" className="sr-only">
        {done
          ? verdict
            ? `Session complete. ${verdict.headline}. ${verdict.body}`
            : "Session complete"
          : `Round ${index + 1} of ${exercises.length}: ${exercise.name}`}
      </p>

      <ol className="flex flex-col gap-2">
        {exercises.map((item, i) => {
          const active = i === index && !done;
          const complete = done || i < index;
          return (
            <li key={item.slug}>
              <button
                type="button"
                onClick={() => {
                  haptic("select");
                  goTo(i);
                }}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "press flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left outline-none",
                  "focus-visible:ring-3 focus-visible:ring-ring/50",
                  active && "border-primary/70 dark:shadow-[0_0_16px_-4px_var(--primary)]",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 -skew-x-6 items-center justify-center font-mono text-xs font-bold tabular-nums",
                    active
                      ? "bg-primary text-primary-foreground"
                      : complete
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {complete && !active ? (
                    <Check className="size-4 skew-x-6" />
                  ) : (
                    <span className="skew-x-6">{i + 1}</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{item.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.target}
                  </span>
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {active ? formatCountdown(remaining) : formatCountdown(FACE_GYM_ROUND_SECONDS)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
