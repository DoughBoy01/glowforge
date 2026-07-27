import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScoreLevelBadge } from "@/components/app/score-level-badge";
import { METRIC_META } from "@/lib/metrics";
import type { CategoryPriority } from "@/lib/insights";

export function CategoryPriorities({ priorities }: { priorities: CategoryPriority[] }) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle>Where to focus</CardTitle>
        <CardDescription>
          Ranked worst to best from your latest scores — 100 is the best a category can score.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border/60">
        {priorities.map((p) => (
          <div key={p.metric} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 md:gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium">{METRIC_META[p.metric].label}</div>
              <div className="text-xs text-muted-foreground">{p.guidance}</div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="font-mono text-sm font-bold tabular-nums">{p.score}</span>
              <ScoreLevelBadge score={p.score} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
