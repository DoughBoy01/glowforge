import { cn } from "@/lib/utils";

const CIRCUMFERENCE = 2 * Math.PI * 42;

export function ScoreRing({
  score,
  label,
  /** Fixed pixel size. Ignored when `className` sets the box instead. */
  size = 160,
  /**
   * Sizing utilities (e.g. `size-44 md:size-35`) for the responsive case —
   * the ring is drawn from a viewBox, so it scales to whatever box it's
   * given rather than needing a breakpoint-aware number in JS.
   */
  className,
}: {
  score: number;
  label?: string;
  size?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={className ? undefined : { width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out dark:[filter:drop-shadow(0_0_6px_var(--primary))]"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-3xl font-bold tabular-nums">{clamped}</span>
        {label && <span className="text-xs text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}
