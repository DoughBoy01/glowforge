"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/app/sparkline";
import { DeltaBadge } from "@/components/app/delta-badge";
import { METRIC_META, type TrackedMetric } from "@/lib/metrics";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export interface MetricRailItem {
  metric: TrackedMetric;
  score: number;
  previousScore: number | null;
  /** Oldest-first scores for this metric's sparkline. */
  history: number[];
}

/**
 * The four tracked metrics: a paged swipe rail on a phone, a plain grid from
 * `md:` up.
 *
 * The rail isn't decoration — paging is what buys the room for a trend line
 * and a delta on each card instead of a bare number in a quarter-width tile.
 * Everything about it is native scroll snapping, so the swipe has real
 * momentum and rubber-banding rather than a JS approximation, and the dots
 * below only mirror where that scroll ended up.
 */
export function MetricRail({ items }: { items: MetricRailItem[] }) {
  const railRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState(0);
  const frame = React.useRef(0);

  // Scroll fires far faster than the dots need to change, so the read is
  // coalesced into one frame.
  function onScroll() {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const el = railRef.current;
      if (!el) return;
      const children = Array.from(el.children) as HTMLElement[];
      if (!children.length) return;
      const origin = children[0].offsetLeft;
      let nearest = 0;
      let best = Infinity;
      children.forEach((child, i) => {
        const distance = Math.abs(child.offsetLeft - origin - el.scrollLeft);
        if (distance < best) {
          best = distance;
          nearest = i;
        }
      });
      setActive(nearest);
    });
  }

  React.useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function scrollTo(index: number) {
    const el = railRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    const target = children[index];
    if (!target) return;
    haptic("select");
    el.scrollTo({ left: target.offsetLeft - children[0].offsetLeft, behavior: "smooth" });
  }

  return (
    <div>
      <div
        ref={railRef}
        onScroll={onScroll}
        className={cn(
          // Full-bleed on a phone so a card can sit half off the edge and
          // read as "there's more this way" without a chevron.
          // `no-scrollbar`: the dots below are the position indicator, and a
          // scrollbar track under the cards reads as a web page, not an app.
          "snap-rail no-scrollbar -mx-4 gap-3 px-4 pb-1",
          "md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-4",
        )}
      >
        {items.map((item) => {
          const meta = METRIC_META[item.metric];
          const delta = item.previousScore === null ? null : item.score - item.previousScore;

          return (
            <div key={item.metric} className="w-[74%] max-w-72 md:w-auto md:max-w-none">
              <Card className="h-full border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="truncate text-sm font-medium text-muted-foreground">
                    {meta.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-bold tabular-nums md:text-3xl">
                      {item.score}
                    </span>
                    <DeltaBadge delta={delta} emptyLabel="baseline" />
                  </div>
                  <Sparkline
                    values={item.history}
                    width={220}
                    height={36}
                    className="h-9 w-full"
                  />
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Page dots. Tappable as well as indicative — a thumb already resting
          at the bottom of the screen shouldn't have to reach up to swipe. */}
      <div className="mt-1 flex justify-center md:hidden">
        {items.map((item, i) => (
          <button
            key={item.metric}
            type="button"
            onClick={() => scrollTo(i)}
            className="flex size-8 items-center justify-center outline-none"
          >
            <span
              className={cn(
                "size-1.5 rounded-full transition-colors",
                i === active ? "bg-primary" : "bg-muted-foreground/35",
              )}
            />
            <span className="sr-only">Show {METRIC_META[item.metric].label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
