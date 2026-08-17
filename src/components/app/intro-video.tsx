"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

const SESSION_KEY = "gf_intro_seen";
/** Safety net only — `ended`/`error` normally hide this first. ~3s of
 * headroom past the ~5.04s clip for network fetch + decode startup. */
const FALLBACK_TIMEOUT_MS = 8000;
/** `ended` doesn't fire reliably in every browser/encode combination — this
 * catches "reached the last frame" a different way, off `timeupdate`. */
const END_EPSILON_S = 0.15;
/** Must match `.animate-lock-off`'s duration in globals.css — how long the
 * exit transition plays before the overlay actually unmounts. */
const EXIT_DURATION_MS = 480;

// useLayoutEffect warns if it runs during SSR (a no-op there either way);
// aliasing to useEffect server-side keeps pre-paint timing on the client,
// where it's what keeps a same-session remount (e.g. nav away and back)
// from flashing the overlay before the sessionStorage check hides it.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function IntroVideo() {
  const [visible, setVisible] = useState(true);
  const [shouldPlay, setShouldPlay] = useState(false);
  const [started, setStarted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Pass 1, pre-paint: the session-gating decision. This can't touch
  // `videoRef` — the <video> below is portaled and only rendered once this
  // flips `shouldPlay`, so on this pass the ref is still null.
  useIsomorphicLayoutEffect(() => {
    try {
      // A hard refresh should replay the intro even within the same
      // session — only an SPA remount (e.g. nav away and back, which
      // never produces a "reload" navigation entry) stays suppressed.
      const [navEntry] = performance.getEntriesByType(
        "navigation",
      ) as PerformanceNavigationTiming[];
      if (navEntry?.type === "reload") {
        sessionStorage.removeItem(SESSION_KEY);
      }

      if (sessionStorage.getItem(SESSION_KEY)) {
        setVisible(false);
        return;
      }
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Storage unavailable — fail open and just show the launch prompt.
    }
    setShouldPlay(true);
  }, []);

  // A hard cut from full-screen video straight to the dashboard read as
  // jarring. `exiting` plays a brief dissolve (`animate-lock-off`) first;
  // reduced-motion skips straight to hidden rather than sitting on the
  // animation's held end-state for a duration it isn't actually playing.
  const hide = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(false);
    } else {
      setExiting(true);
    }
  };

  // Once launched: wire up the hide triggers. Playback itself is started
  // directly in `launch()`, synchronously inside the click — not here —
  // since browsers only treat `play()` as gesture-backed when it's called
  // without an intervening render/effect hop.
  useIsomorphicLayoutEffect(() => {
    if (!started) return;
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.duration && video.currentTime >= video.duration - END_EPSILON_S) {
        hide();
      }
    };
    video.addEventListener("ended", hide);
    video.addEventListener("timeupdate", handleTimeUpdate);
    const timeout = setTimeout(hide, FALLBACK_TIMEOUT_MS);
    return () => {
      video.removeEventListener("ended", hide);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      clearTimeout(timeout);
    };
  }, [started]);

  // Once the exit transition starts, actually unmount once it's finished.
  useIsomorphicLayoutEffect(() => {
    if (!exiting) return;
    const timeout = setTimeout(() => setVisible(false), EXIT_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [exiting]);

  const launch = () => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {});
    setStarted(true);
  };

  if (!visible || !shouldPlay) return null;

  // Portaled straight to <body>: the dashboard's route-transition animation
  // (`animate-page-in` in AppShell) leaves a non-`none` `transform` on an
  // ancestor for as long as it's mounted, which — per spec, regardless of
  // whether the matrix is geometrically an identity — makes that ancestor
  // the containing block for any `position: fixed` descendant. Rendered
  // in place, this overlay would be confined to that ancestor's (much
  // taller, offset) box instead of the true viewport. Portaling sidesteps
  // the ancestor chain entirely rather than touching that shared animation.
  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black",
        exiting && "animate-lock-off",
      )}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        src="/intro.mp4"
        playsInline
        preload="auto"
        onError={hide}
      />
      {!started && (
        <button
          type="button"
          onClick={launch}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <Play className="size-7 translate-x-0.5" fill="currentColor" />
          </span>
          <span className="font-mono text-xs font-bold tracking-[0.16em] uppercase">
            Launch
          </span>
        </button>
      )}
    </div>,
    document.body,
  );
}
