import { scoreLevelLabel } from "@/lib/insights";
import type { PriorityLevel } from "@/lib/insights";
import { cn } from "@/lib/utils";

// `on_track` deliberately isn't `primary` — this app's primary is a neon
// pink close enough to `destructive`'s red that the two read as the same
// color at badge size, which would defeat the entire point of the badge.
// `accent` is the palette's cyan, reserved for "data/trust" — a clearly
// distinct, unambiguously neutral-to-good hue between amber and emerald.
const LEVEL_DOT: Record<PriorityLevel, string> = {
  critical: "bg-destructive",
  needs_work: "bg-amber-500",
  on_track: "bg-accent",
  excellent: "bg-emerald-500",
};

const LEVEL_TEXT: Record<PriorityLevel, string> = {
  critical: "text-destructive",
  needs_work: "text-amber-500",
  on_track: "text-accent",
  excellent: "text-emerald-500",
};

/**
 * The good-or-bad read on a bare 0-100 score. A number alone doesn't tell a
 * first-time user which direction is winning or whether 62 is fine or
 * worrying — this names it, every place a raw score appears without the
 * surrounding "worst to best" ranking `CategoryPriorities` already has.
 */
export function ScoreLevelBadge({ score, className }: { score: number; className?: string }) {
  const { level, label } = scoreLevelLabel(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[0.625rem] font-bold tracking-[0.12em] uppercase",
        LEVEL_TEXT[level],
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", LEVEL_DOT[level])} />
      {label}
    </span>
  );
}
