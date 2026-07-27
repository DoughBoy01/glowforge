import Link from "next/link";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

/** Segments in a streak meter — one week, the unit people actually count in. */
const STREAK_SEGMENTS = 7;

/**
 * One habit's streak, as a HUD gauge.
 *
 * The meter is segmented rather than a continuous bar, and it fills over a
 * week before it caps: a bar scaled to some arbitrary ceiling would make day
 * three look like nothing, whereas three of seven lit reads as progress on
 * the first tile someone ever sees. Past seven it stays full and the number
 * carries the rest — the point of the gauge is the current week, not a
 * lifetime total.
 *
 * The flame only lights once there's a streak to light it: a burning icon
 * over a zero is a scolding, and this tile is read by people on day one as
 * often as by people on day forty.
 */
export function StreakTile({
  href,
  label,
  days,
  footer,
}: {
  href: string;
  label: string;
  days: number;
  footer: string;
}) {
  const live = days > 0;
  const lit = Math.min(days, STREAK_SEGMENTS);

  return (
    <Link
      href={href}
      className="block outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div
        className={cn(
          "press hud-notch flex h-full flex-col gap-3 border p-4 transition-colors active:bg-muted/40",
          live ? "border-primary/40 bg-primary/[0.05]" : "border-border/60",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
            {label}
          </span>
          <Flame
            className={cn("size-4 shrink-0", live ? "neon text-primary" : "text-muted-foreground/40")}
            strokeWidth={live ? 2.2 : 1.8}
          />
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className={cn("display text-4xl leading-none tabular-nums", live && "text-primary")}>
            {days}
          </span>
          <span className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
            {days === 1 ? "day" : "days"}
          </span>
        </div>

        {/* The gauge. Decorative — the count above already states it, and
            "3 of 7 segments lit" is not a sentence worth reading aloud. */}
        <div aria-hidden className="flex gap-1">
          {Array.from({ length: STREAK_SEGMENTS }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 -skew-x-12 transition-colors",
                i < lit ? "bg-primary dark:shadow-[0_0_6px_var(--primary)]" : "bg-muted",
              )}
            />
          ))}
        </div>

        <span className="truncate text-xs text-muted-foreground">{footer}</span>
      </div>
    </Link>
  );
}
