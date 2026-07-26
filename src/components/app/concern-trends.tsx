import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkline } from "@/components/app/sparkline";
import { DeltaBadge } from "@/components/app/delta-badge";
import type { ConcernTrend } from "@/lib/progress";

/**
 * Concern-level history — the raw signals behind the four rolled-up
 * metrics, each with its own line over time. Someone whose routine targets
 * one thing (acne, redness, pores) needs to watch that specific number
 * move, not infer it from a composite that averages it away.
 */
export function ConcernTrends({ trends }: { trends: ConcernTrend[] }) {
  if (!trends.length) return null;

  const multiScan = trends.some((t) => t.points.length > 1);

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle>Concern history</CardTitle>
        <CardDescription>
          {multiScan
            ? "Every signal your photos have been scored on, worst first — change is measured against your first analyzed check-in."
            : "Every signal your photos have been scored on, worst first. Log another check-in to start seeing movement here."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {trends.map((t) => (
          <div key={t.concern} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{t.label}</span>
              <span className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-bold tabular-nums">{t.current}</span>
                <DeltaBadge delta={t.allTimeDelta} emptyLabel="new" />
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Sparkline values={t.points.map((p) => p.score)} className="h-7 w-24" />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${t.current}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.points.length > 1
                ? `${t.points.length} readings · first ${t.first}, now ${t.current}`
                : "First reading — no trend yet"}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
