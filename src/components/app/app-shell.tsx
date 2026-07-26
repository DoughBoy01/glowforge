"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { useAppBack } from "@/hooks/use-app-back";
import { adjacentTab, isSubScreen } from "@/lib/nav";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** Indicator travel (post-resistance) at which a pull commits to a refresh. */
const PULL_THRESHOLD = 56;
/** Hard stop on the pull, so a long drag doesn't shove content off-screen. */
const PULL_MAX = 96;
/** Width of the left-edge strip that arms the swipe-back gesture. */
const EDGE_WIDTH = 28;
/** Fraction of the viewport a back-swipe must cross to commit. */
const BACK_COMMIT_RATIO = 0.32;
/** Fraction of the viewport a tab swipe must cross to change tabs. */
const TAB_COMMIT_RATIO = 0.26;
/** How much of a tab swipe the content follows — a hint, not a full drag. */
const TAB_FOLLOW = 0.32;
/** Follow ratio at the ends of the tab list, where there's nowhere to go. */
const TAB_RESIST = 0.1;
/** Movement before we decide which gesture (if either) this touch is. */
const SLOP = 10;

type Gesture = "undecided" | "pull" | "back" | "tab" | "ignored";

/** Rubber-band curve: the further you pull, the less each pixel gives. */
function resist(distance: number) {
  return Math.min(PULL_MAX, distance * 0.5);
}

/** Any open modal owns the gesture — sheets have their own drag-to-dismiss. */
function modalIsOpen() {
  return !!document.querySelector(
    '[data-slot="bottom-sheet-content"], [data-slot="dialog-content"], [data-slot="sheet-content"]',
  );
}

function ancestors(target: EventTarget | null) {
  const chain: Element[] = [];
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body) {
    chain.push(node);
    node = node.parentElement;
  }
  return chain;
}

/**
 * True when the touch began inside something that can itself scroll up — a
 * sheet body, a chart's horizontal rail, a `max-h` overflow list. Claiming
 * the gesture there would steal a scroll the user meant for that element.
 */
function insideScrolledContainer(target: EventTarget | null) {
  return ancestors(target).some((node) => node.scrollTop > 0);
}

/**
 * True when the touch began somewhere that owns horizontal movement: a scroll
 * rail like the metric carousel, or anything opting out with `data-no-swipe`.
 * Without this, swiping the carousel would also change tabs.
 */
function ownsHorizontalGesture(target: EventTarget | null) {
  return ancestors(target).some((node) => {
    if (node.hasAttribute("data-no-swipe")) return true;
    if (node.scrollWidth <= node.clientWidth + 1) return false;
    const overflowX = getComputedStyle(node).overflowX;
    return overflowX === "auto" || overflowX === "scroll";
  });
}

/** The app bar and tab bar are chrome; gestures there aren't page gestures. */
function insideAppChrome(target: EventTarget | null) {
  return ancestors(target).some((node) => node.hasAttribute("data-app-chrome"));
}

/**
 * Wraps the app's scrolling content with the gestures a native app has and a
 * browser doesn't — pull-to-refresh, edge-swipe-to-go-back, and swipe
 * left/right between tabs — and plays the page-enter transition on
 * navigation.
 *
 * All three are touch-only and arm only on coarse pointers, so a desktop
 * mouse never triggers them and the desktop layout is untouched. Back and tab
 * swipes are also mutually exclusive by route: swipe-back only exists on
 * pushed screens, tab swiping only on tab roots.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const goBack = useAppBack();

  const [pull, setPull] = React.useState(0);
  /** Horizontal follow, shared by the back and tab gestures. */
  const [slide, setSlide] = React.useState(0);
  const [settling, setSettling] = React.useState(false);
  const [isRefreshing, startRefresh] = React.useTransition();

  // Live gesture values, mirrored for the touchend handler: reading them
  // from a state updater would mean running side effects inside one.
  const pullRef = React.useRef(0);
  const slideRef = React.useRef(0);
  // Read inside the listeners without re-subscribing on every navigation.
  const pathnameRef = React.useRef(pathname);
  pathnameRef.current = pathname;

  React.useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    let gesture: Gesture = "ignored";
    let startX = 0;
    let startY = 0;
    let armedPull = false;
    let armedBack = false;
    let armedTab = false;
    /** Set once a tab swipe picks a direction; null means nowhere to go. */
    let tabTarget: string | null = null;

    const setPullValue = (value: number) => {
      pullRef.current = value;
      setPull(value);
    };
    const setSlideValue = (value: number) => {
      slideRef.current = value;
      setSlide(value);
    };

    function onTouchStart(event: TouchEvent) {
      // Multi-touch is a pinch-zoom; a modal owns its own gestures; a
      // scrolled inner container owns the scroll that started inside it; and
      // the nav bars aren't the page.
      if (
        event.touches.length !== 1 ||
        modalIsOpen() ||
        insideAppChrome(event.target) ||
        insideScrolledContainer(event.target)
      ) {
        gesture = "ignored";
        return;
      }
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      gesture = "undecided";
      tabTarget = null;

      const nested = isSubScreen(pathnameRef.current);
      // Only a pull that begins at the very top of the document can be a
      // refresh; anywhere else it's an ordinary scroll.
      armedPull = window.scrollY <= 0;
      armedBack = nested && startX <= EDGE_WIDTH;
      // Tab swipes start away from both edges, leaving the browser's own edge
      // gestures intact, and never fire inside a rail that scrolls
      // horizontally itself.
      armedTab =
        !nested &&
        startX > EDGE_WIDTH &&
        startX < window.innerWidth - EDGE_WIDTH &&
        !ownsHorizontalGesture(event.target);
      setSettling(false);
    }

    function onTouchMove(event: TouchEvent) {
      if (gesture === "ignored") return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (gesture === "undecided") {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        const horizontal = Math.abs(dx) > Math.abs(dy);
        if (armedBack && dx > 0 && horizontal) {
          gesture = "back";
        } else if (armedTab && horizontal) {
          gesture = "tab";
          // Swiping left moves forwards through the tabs, the way pages move
          // under your thumb.
          tabTarget = adjacentTab(pathnameRef.current, dx < 0 ? 1 : -1);
        } else if (armedPull && dy > 0 && !horizontal && window.scrollY <= 0) {
          gesture = "pull";
        } else {
          // An ordinary scroll. Hands the touch back to the browser
          // untouched.
          gesture = "ignored";
          return;
        }
      }

      if (gesture === "pull") {
        if (window.scrollY > 0) {
          gesture = "ignored";
          setPullValue(0);
          return;
        }
        // The listener is non-passive, so this genuinely suppresses the
        // native overscroll bounce that would fight the indicator.
        event.preventDefault();
        setPullValue(resist(dy));
      } else if (gesture === "back") {
        event.preventDefault();
        setSlideValue(Math.max(0, Math.min(dx, window.innerWidth)));
      } else if (gesture === "tab") {
        event.preventDefault();
        // At either end of the tab list the content barely moves — that dead
        // weight is the answer to "is there another tab this way?".
        setSlideValue(dx * (tabTarget ? TAB_FOLLOW : TAB_RESIST));
      }
    }

    function onTouchEnd() {
      if (gesture === "pull") {
        const committed = pullRef.current >= PULL_THRESHOLD;
        setSettling(true);
        setPullValue(0);
        if (committed) {
          haptic("impact");
          startRefresh(() => router.refresh());
        }
      } else if (gesture === "back") {
        if (slideRef.current >= window.innerWidth * BACK_COMMIT_RATIO) {
          haptic("select");
          // Content stays parked where the finger left it: the incoming route
          // resets it, so springing home here would flash the old screen
          // sliding back before the new one arrives.
          goBack();
        } else {
          setSettling(true);
          setSlideValue(0);
        }
      } else if (gesture === "tab") {
        // Compare against the distance the finger actually travelled, not the
        // damped follow, so the threshold means the same thing as it does for
        // the back gesture.
        const travelled = Math.abs(slideRef.current) / TAB_FOLLOW;
        if (tabTarget && travelled >= window.innerWidth * TAB_COMMIT_RATIO) {
          haptic("select");
          router.push(tabTarget);
        } else {
          setSettling(true);
          setSlideValue(0);
        }
      }
      gesture = "ignored";
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    // `passive: false` is what makes preventDefault effective here.
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [router, goBack]);

  // A completed navigation resets the swipe offset for the incoming screen.
  React.useEffect(() => {
    slideRef.current = 0;
    setSlide(0);
    setSettling(false);
  }, [pathname]);

  // Hold the indicator open while the server component tree refetches, so
  // the spinner reflects real work rather than a fixed animation.
  const offset = isRefreshing ? Math.max(pull, PULL_THRESHOLD) : pull;

  return (
    <div className="relative flex flex-1 flex-col overflow-x-clip">
      <PullIndicator offset={offset} refreshing={isRefreshing} />

      {/* Only the back gesture gets a chevron; a tab swipe is answered by the
          tab bar's own marker moving. */}
      {slide > 0 && isSubScreen(pathname) && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-y-0 left-0 z-30 flex items-center pl-3 text-muted-foreground"
          style={{ opacity: Math.min(1, slide / 90) }}
        >
          <ChevronLeft className="size-7" />
        </div>
      )}

      <div
        className={cn(
          "flex flex-1 flex-col",
          settling && "transition-transform duration-300 ease-out",
        )}
        style={
          offset || slide
            ? { transform: `translate3d(${slide * 0.92}px, ${offset}px, 0)` }
            : undefined
        }
      >
        {/* Keyed on the route so every navigation replays the enter
            transition — a compositor-only stand-in for a native push. */}
        <div key={pathname} className="animate-page-in flex flex-1 flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}

function PullIndicator({ offset, refreshing }: { offset: number; refreshing: boolean }) {
  if (offset <= 0 && !refreshing) return null;
  const progress = Math.min(1, offset / PULL_THRESHOLD);
  const armed = progress >= 1;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center"
      style={{ transform: `translate3d(0, ${offset - 44}px, 0)` }}
    >
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-full border border-border/70 bg-card",
          armed && "border-primary/60",
        )}
        style={{ opacity: Math.min(1, progress * 1.6) }}
      >
        <RefreshCw
          className={cn(
            "size-4",
            armed ? "text-primary" : "text-muted-foreground",
            refreshing && "animate-spin",
          )}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
        />
      </div>
    </div>
  );
}
