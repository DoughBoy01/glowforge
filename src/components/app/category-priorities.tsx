import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { METRIC_META } from "@/lib/metrics";
import type { CategoryPriority } from "@/lib/insights";
import { cn } from "@/lib/utils";

const LEVEL_DOT: Record<CategoryPriority["level"], string> = {
  critical: "bg-destructive",
  needs_work: "bg-amber-500",
  on_track: "bg-primary",
  excellent: "bg-emerald-500",
};

export function CategoryPriorities({ priorities }: { priorities: CategoryPriority[] }) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle>Where to focus</CardTitle>
        <CardDescription>Ranked worst to best from your latest scores.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border/60">
        {priorities.map((p) => (
          <div key={p.metric} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 md:gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn("size-2 shrink-0 rounded-full", LEVEL_DOT[p.level])} />
              <div className="min-w-0">
                <div className="text-sm font-medium">{METRIC_META[p.metric].label}</div>
                <div className="text-xs text-muted-foreground">{p.guidance}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-baseline gap-2 font-mono text-sm tabular-nums">
              <span className="font-bold">{p.score}</span>
              <span className="text-xs text-muted-foreground">{p.label}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
