import { METRIC_META } from "@/lib/metrics";
import type { ProjectedScore } from "@/lib/insights";

/**
 * "Current vs improved" visualization. Deliberately a grounded data
 * comparison (your measured score → a realistic near-term target) rather
 * than a synthesized before/after photo — we don't have a way to generate
 * a trustworthy "improved" image of someone's actual face, and faking one
 * would work against the trust this page is supposed to build.
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
