import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeltaBadge } from "@/components/app/delta-badge";
import { getPredictionCheckInsight } from "@/lib/insights";
import { formatShortDate } from "@/lib/format";

/**
 * Grades the previous check-in's goal-image projection against this scan's
 * real measurement — the other half of "closing the loop": `GoalPreview`
 * shows the projection when it's made, this shows how it held up.
 *
 * A server component: everything it needs is already settled by the time the
 * results page renders (both scans are real, complete rows), so there's
 * nothing to poll for here the way `GoalPreview` has to.
 */
export function PredictionCheck({
  predictedSkinAge,
  actualSkinAge,
  sourceCapturedAt,
}: {
  predictedSkinAge: number;
  actualSkinAge: number;
  sourceCapturedAt: Date;
}) {
  const insight = getPredictionCheckInsight(predictedSkinAge, actualSkinAge);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
          Prediction check
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl leading-none font-bold tabular-nums">
            {actualSkinAge}
          </span>
          {/* Real scan came in younger than projected reads as an improvement,
              same direction convention as every other face-age delta. */}
          <DeltaBadge delta={insight.delta} lowerIsBetter />
        </div>
        <p className="text-xs text-muted-foreground">{insight.message}</p>
        <p className="text-xs text-muted-foreground/70">
          Projected from your {formatShortDate(sourceCapturedAt)} goal image, graded against this
          scan.
        </p>
      </CardContent>
    </Card>
  );
}
