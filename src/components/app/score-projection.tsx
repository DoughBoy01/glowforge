import { METRIC_META } from "@/lib/metrics";
import type { ProjectedScore } from "@/lib/insights";

/**
 * "Current vs improved" visualization: measured score → realistic near-term
 * target, per category.
 *
 * This used to be the *only* goal visual, on the grounds that a synthesized
 * "after" face would work against the trust the page is built to earn.
 * `GoalPreview` now renders one anyway — but it doesn't replace this, and
 * that's the point. The image is capped, derived from these same measurements
 * and labelled as a simulation; these bars are the falsifiable version, the
 * one the next scan can be checked against. Shipping the picture without them
 * is what the original objection was actually about.
 */
export function ScoreProjection({ scores }: { scores: ProjectedScore[] }) {
  return (
    <div className="flex flex-col gap-5">
      {scores.map((s) => (
        <div key={s.metric} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">{METRIC_META[s.metric].label}</span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {s.current} <span className="mx-1">→</span>
              <span className="font-semibold text-foreground">{s.projected}</span>
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary/25 transition-[width] duration-700 ease-out"
              style={{ width: `${s.projected}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-700 ease-out"
              style={{ width: `${s.current}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
