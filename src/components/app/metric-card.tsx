import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { METRIC_META, scoreDeltaLabel, type TrackedMetric } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export function MetricCard({
  metric,
  score,
  previousScore,
}: {
  metric: TrackedMetric;
  score: number;
  previousScore: number | null;
}) {
  const meta = METRIC_META[metric];
  const delta = previousScore === null ? null : score - previousScore;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        {/* Two of these sit side by side on a phone, so the label has to
            survive half the screen width without wrapping into the number. */}
        <CardTitle className="truncate text-sm font-medium text-muted-foreground">
          {meta.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-3xl font-bold tabular-nums">{score}</span>
          {delta !== null && (
            <span
              className={cn(
                "font-mono text-xs font-medium",
                delta > 0 && "text-emerald-500",
                delta < 0 && "text-destructive",
                delta === 0 && "text-muted-foreground",
              )}
            >
              {scoreDeltaLabel(score, previousScore)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
