import { Sunrise, Sunset } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductLink } from "@/components/app/product-link";
import { SaveRoutineButton } from "@/components/app/save-routine-button";
import { ROUTINE_RULES, type DailyRoutine, type RoutineSlot } from "@/lib/daily-routine";
import type { PriorityLevel } from "@/lib/insights";

const SLOT_ICON: Record<RoutineSlot, typeof Sunrise> = {
  am: Sunrise,
  pm: Sunset,
};

const LEVEL_VARIANT: Record<PriorityLevel, "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  needs_work: "secondary",
  on_track: "outline",
  excellent: "outline",
};

const LEVEL_LABEL: Record<PriorityLevel, string> = {
  critical: "Critical",
  needs_work: "Needs work",
  on_track: "On track",
  excellent: "Maintain",
};

/**
 * The generated plan, rendered as two runnable sequences rather than a
 * ranked list of advice.
 *
 * Numbering is the point: the order on screen is the order to do it in, so
 * nothing here re-sorts by severity. The one score-driven signal that does
 * surface is the "Start here" flag on the step from the worst category —
 * for anyone who is only going to keep one habit, that's which one.
 */
export function DailyRoutinePlan({
  routines,
  scanId,
  /** The results page frames this as "from today's scan"; the routine page as "we built it". */
  description = "Built from this check-in. Two runs a day — the order matters as much as the products.",
  showSave = true,
}: {
  routines: DailyRoutine[];
  scanId?: string;
  description?: string;
  showSave?: boolean;
}) {
  const hasProducts = routines.some((r) => r.steps.some((s) => s.products.length > 0));

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle>Your daily routine</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      {routines.map((routine) => {
        const Icon = SLOT_ICON[routine.slot];
        return (
          <CardContent key={routine.slot} className="flex flex-col gap-4 border-t border-border/60 pt-5 first:border-t-0 first:pt-0">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-8 shrink-0 -skew-x-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Icon className="size-4 skew-x-6" strokeWidth={2.1} />
                </span>
                <span className="font-heading">{routine.name}</span>
                <span className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
                  {routine.durationLabel}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{routine.summary}</p>
            </div>

            <ol className="flex flex-col divide-y divide-border/60">
              {routine.steps.map((step, i) => (
                <li key={`${routine.slot}-${step.key}`} className="flex gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-bold tabular-nums">
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold">{step.name}</span>
                      {step.isPriority && (
                        <Badge className="text-[10px]">Start here</Badge>
                      )}
                      {step.metricLabel && (
                        <Badge variant="outline" className="text-[10px]">
                          {step.metricLabel}
                        </Badge>
                      )}
                      {step.level && (
                        <Badge variant={LEVEL_VARIANT[step.level]} className="text-[10px]">
                          {LEVEL_LABEL[step.level]}
                        </Badge>
                      )}
                    </div>

                    <span className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
                      {step.frequency}
                    </span>

                    {/* The instruction leads. "Why" is real motivation but it
                        is not what someone standing at a sink at 7am needs
                        first, so it sits underneath in a quieter weight. */}
                    <p className="text-sm">{step.how}</p>
                    <p className="text-sm text-muted-foreground">{step.why}</p>

                    {step.products.length > 0 && (
                      <div className="flex flex-col gap-1.5 pt-1">
                        {step.products.map((product) => (
                          <ProductLink
                            key={product.id}
                            product={product}
                            metric={step.metric ?? step.key}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        );
      })}

      <CardContent className="flex flex-col gap-4 border-t border-border/60 pt-5">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
            Rules that matter more than the products
          </span>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {ROUTINE_RULES.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span aria-hidden className="text-muted-foreground/60">
                  —
                </span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        {hasProducts && (
          <p className="text-xs text-muted-foreground">
            Product picks are affiliate links — we may earn a commission at no cost to you. We only
            recommend products with real clinical backing, regardless of commission.
          </p>
        )}

        {showSave && <SaveRoutineButton scanId={scanId} className="w-full sm:w-auto sm:self-start" />}
      </CardContent>
    </Card>
  );
}
