"use client";

import * as React from "react";
import Link from "next/link";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** Width of one action tile — comfortably past the 44px touch minimum. */
const ACTION_WIDTH = 76;
/** Movement before the gesture commits to an axis. */
const SLOP = 8;
/** Follow ratio once dragged past either stop, for a rubber-band feel. */
const OVERDRAG = 0.2;

/** Only one row stays open at a time, the way a native list behaves. */
let closeOpenRow: (() => void) | null = null;

/**
 * A list row whose secondary actions live under a leftward swipe.
 *
 * Touch-only by construction: the handlers are touch events, so a mouse can
 * never open the drawer and the desktop row is exactly what it was. The
 * actions still have to be reachable without the gesture — everything hidden
 * here is also on the screen the row itself opens.
 */
export function SwipeRow({
  actions,
  actionCount,
  children,
  className,
}: {
  /** Action tiles, rendered right-to-left as the row slides away. */
  actions: React.ReactNode;
  /** How many tiles `actions` renders — sets the travel distance. */
  actionCount: number;
  children: React.ReactNode;
  className?: string;
}) {
  const [offset, setOffset] = React.useState(0);
  const [animating, setAnimating] = React.useState(true);
  const openWidth = actionCount * ACTION_WIDTH;
  const open = offset <= -openWidth + 1;

  const gesture = React.useRef<{ x: number; y: number; base: number; axis: "" | "x" | "y" }>({
    x: 0,
    y: 0,
    base: 0,
    axis: "",
  });

  const close = React.useCallback(() => {
    setAnimating(true);
    setOffset(0);
  }, []);

  // Kept in a ref so the module-level "currently open row" can hold a stable
  // handle across re-renders.
  const closeRef = React.useRef(close);
  closeRef.current = close;

  React.useEffect(
    () => () => {
      if (closeOpenRow === closeRef.current) closeOpenRow = null;
    },
    [],
  );

  function settleOpen() {
    if (closeOpenRow && closeOpenRow !== closeRef.current) closeOpenRow();
    closeOpenRow = closeRef.current;
    if (!open) haptic("select");
    setAnimating(true);
    setOffset(-openWidth);
  }

  function onTouchStart(event: React.TouchEvent) {
    if (event.touches.length !== 1) return;
    gesture.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
      base: offset,
      axis: "",
    };
    setAnimating(false);
  }

  function onTouchMove(event: React.TouchEvent) {
    if (event.touches.length !== 1) return;
    const dx = event.touches[0].clientX - gesture.current.x;
    const dy = event.touches[0].clientY - gesture.current.y;

    if (!gesture.current.axis) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      // A vertical decision is final: the browser keeps the scroll, which is
      // why the wrapper allows `pan-y` rather than blocking touch entirely.
      gesture.current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (gesture.current.axis !== "x") return;

    let next = gesture.current.base + dx;
    if (next > 0) next *= OVERDRAG;
    else if (next < -openWidth) next = -openWidth + (next + openWidth) * OVERDRAG;
    setOffset(next);
  }

  function onTouchEnd() {
    if (gesture.current.axis !== "x") return;
    gesture.current.axis = "";
    if (offset < -openWidth / 2) settleOpen();
    else close();
  }

  return (
    <div
      data-no-swipe=""
      className={cn("relative overflow-hidden rounded-xl", className)}
      // Vertical panning stays with the browser; horizontal comes to us.
      style={{ touchAction: "pan-y" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        // `inert` keeps the drawer out of the tab order and the a11y tree
        // while it's tucked behind the row, and blocks stray taps on it.
        inert={!open}
        className="absolute inset-y-0 right-0 flex"
        style={{ width: openWidth }}
      >
        {actions}
      </div>

      <div
        className={cn("relative", animating && "transition-transform duration-200 ease-out")}
        style={offset ? { transform: `translate3d(${offset}px, 0, 0)` } : undefined}
        // With the drawer open the row is a "close me" target, not a link.
        onClickCapture={(event) => {
          if (!open) return;
          event.preventDefault();
          event.stopPropagation();
          close();
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * One tile in a `SwipeRow` drawer.
 *
 * `icon` is an element, not a component type — server components render these
 * tiles, and a component function can't cross the client boundary as a prop.
 */
export function SwipeAction({
  href,
  icon,
  label,
  tone = "default",
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  tone?: "default" | "primary";
}) {
  return (
    <Link
      href={href}
      onPointerDown={() => haptic("impact")}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 font-mono text-[0.625rem] font-bold tracking-[0.1em] uppercase outline-none",
        tone === "primary"
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
