"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "@/lib/nav";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * Primary navigation on phones and small tablets: a fixed bottom tab bar,
 * thumb-reachable.
 *
 * Five peers, no raised centre button. Check-in used to own that slot, and
 * giving it up is the point — see `NAV_ITEMS`. What's left is a flat row of
 * places you might go on any day, which is what a tab bar is for.
 *
 * Hidden from `md:` up, where the sidebar takes over — the two read from
 * the same `NAV_ITEMS` list so they can't diverge.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      data-app-chrome=""
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 md:hidden",
        // Sits above the content it scrolls over; the blur keeps the
        // tactical dark surface readable over charts and photos.
        "border-t border-border/70 bg-background/85 backdrop-blur-xl",
        "supports-[backdrop-filter]:bg-background/70",
        "pb-safe",
      )}
    >
      <ul
        className="mx-auto grid h-tabbar max-w-lg items-stretch px-safe"
        // Column count follows NAV_ITEMS rather than being hard-coded, so
        // adding a destination doesn't silently overflow the row.
        style={{ gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))` }}
      >
        {NAV_ITEMS.map((item) => (
          <Tab key={item.href} item={item} active={isNavItemActive(pathname, item.href)} />
        ))}
      </ul>
    </nav>
  );
}

function Tab({ item, active }: { item: (typeof NAV_ITEMS)[number]; active: boolean }) {
  return (
    <li className="contents">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        onPointerDown={() => haptic("select")}
        className={cn(
          "press relative flex flex-col items-center justify-center gap-1 outline-none",
          "text-muted-foreground active:bg-muted/40",
          "focus-visible:ring-3 focus-visible:ring-ring/50",
          active && "text-primary",
        )}
      >
        {/* Active marker: a short skewed bar under the tab, echoing the
            skewed brand block rather than a generic pill. */}
        <span
          aria-hidden
          className={cn(
            "absolute top-0 h-0.5 w-8 -skew-x-12 bg-primary transition-opacity duration-200",
            active
              ? "opacity-100 dark:shadow-[0_0_12px_var(--primary)]"
              : "opacity-0",
          )}
        />
        <item.icon className="size-5" strokeWidth={active ? 2.4 : 1.9} />
        <span className="font-mono text-[0.625rem] font-bold tracking-[0.12em] uppercase">
          {item.short}
        </span>
      </Link>
    </li>
  );
}
