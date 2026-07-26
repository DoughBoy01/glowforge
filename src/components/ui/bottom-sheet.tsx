"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

/**
 * A modal that is a bottom sheet on touch-sized screens and a centred
 * dialog from `sm:` up.
 *
 * It's one component rather than two behind `useIsMobile()` on purpose:
 * the responsive switch is pure CSS, so there's no hydration flash, no
 * duplicated content in the DOM, and the open sheet doesn't remount if the
 * viewport crosses the breakpoint mid-interaction.
 */
function BottomSheet(props: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="bottom-sheet" {...props} />;
}

function BottomSheetTrigger(props: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="bottom-sheet-trigger" {...props} />;
}

function BottomSheetClose(props: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="bottom-sheet-close" {...props} />;
}

function BottomSheetContent({
  className,
  children,
  /** Set for media-first sheets that shouldn't inset their content. */
  bleed = false,
  ...props
}: SheetPrimitive.Popup.Props & { bleed?: boolean }) {
  const popupRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ startY: number; offset: number } | null>(null);

  /**
   * Drag-to-dismiss, driven from the grabber and header only — dragging
   * anywhere would make a scrollable sheet body impossible to scroll.
   * Writes the transform straight to the node so the drag tracks the
   * finger at native frame rate instead of waiting on React.
   */
  function onPointerDown(event: React.PointerEvent) {
    if (event.pointerType === "mouse") return;
    drag.current = { startY: event.clientY, offset: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    const state = drag.current;
    const node = popupRef.current;
    if (!state || !node) return;
    // Upward drag resists hard: the sheet is already at its natural height.
    const delta = event.clientY - state.startY;
    state.offset = delta > 0 ? delta : delta * 0.2;
    node.style.transition = "none";
    node.style.transform = `translate3d(0, ${state.offset}px, 0)`;
  }

  function onPointerUp(event: React.PointerEvent) {
    const state = drag.current;
    const node = popupRef.current;
    drag.current = null;
    if (!state || !node) return;
    node.style.transition = "";
    node.style.transform = "";

    const height = node.offsetHeight || 1;
    if (state.offset > Math.min(140, height * 0.28)) {
      haptic("select");
      // Let the primitive close so its exit animation and focus
      // restoration run exactly as they do for a button-triggered close.
      event.currentTarget
        .closest("[data-slot=bottom-sheet-content]")
        ?.querySelector<HTMLButtonElement>("[data-sheet-dismiss]")
        ?.click();
    }
  }

  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Backdrop
        data-slot="bottom-sheet-overlay"
        className="fixed inset-0 z-50 bg-black/45 transition-opacity duration-300 supports-backdrop-filter:backdrop-blur-[2px] data-ending-style:opacity-0 data-starting-style:opacity-0"
      />
      <SheetPrimitive.Popup
        ref={popupRef}
        data-slot="bottom-sheet-content"
        className={cn(
          "fixed z-50 flex flex-col bg-popover text-sm text-popover-foreground outline-none",
          "ring-1 ring-foreground/10",
          // Phone: docked to the bottom edge, rounded only at the top, and
          // never taller than the visual viewport minus the status bar.
          "inset-x-0 bottom-0 max-h-[88svh] rounded-t-2xl",
          // Slides from the bottom with an iOS-style decelerating curve.
          "transition-[transform,opacity] duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
          "data-ending-style:translate-y-full data-starting-style:translate-y-full",
          // Tablet/desktop: an ordinary centred dialog again.
          "sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl",
          "sm:data-ending-style:translate-y-[-46%] sm:data-ending-style:opacity-0 sm:data-starting-style:translate-y-[-46%] sm:data-starting-style:opacity-0",
          className,
        )}
        {...props}
      >
        {/* The drag handler clicks this, so dismissal always goes through
            the primitive rather than a second source of truth. Visually
            hidden but still focusable: it doubles as the keyboard and
            screen-reader close control, which the grabber can't be. */}
        <SheetPrimitive.Close data-sheet-dismiss="" className="sr-only">
          Close
        </SheetPrimitive.Close>

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="shrink-0 touch-none pt-2.5 pb-1 sm:hidden"
        >
          <div className="mx-auto h-1 w-9 rounded-full bg-muted-foreground/40" />
        </div>

        <div
          className={cn(
            "no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain",
            // Bleed drops the horizontal gutter on phones only — a
            // centred desktop dialog with edge-to-edge media reads as
            // broken, not immersive.
            bleed ? "pb-sheetsafe sm:p-4" : "px-4 pt-2 pb-sheetsafe sm:p-4",
          )}
        >
          {children}
        </div>
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  );
}

function BottomSheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bottom-sheet-header"
      className={cn("flex flex-col gap-1.5 pb-4 text-left", className)}
      {...props}
    />
  );
}

function BottomSheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bottom-sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 pt-4 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function BottomSheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="bottom-sheet-title"
      className={cn("font-heading text-lg leading-snug font-medium sm:text-base", className)}
      {...props}
    />
  );
}

function BottomSheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="bottom-sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetFooter,
  BottomSheetTitle,
  BottomSheetDescription,
};
