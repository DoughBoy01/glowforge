import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FACE_AGE_LABEL, years } from "@/lib/face-age";
import { cn } from "@/lib/utils";
import type { SkinAgeInsight } from "@/lib/insights";

/**
 * Face age on a single scan's results page — the number that check-in existed
 * to produce. The four metric scores beside it are the explanation for it.
 *
 * The delta here is scan-over-scan, not against the baseline: on a results page
 * the question is "what did this check-in say", and the mission-wide comparison
 * belongs on the home screen, where the whole history is in hand.
 */
export function FaceAgeBadge({ insight }: { insight: SkinAgeInsight }) {
  const { skinAge, deltaFromPrevious } = insight;
  // Down is the win, which is the opposite of every score metric on this page —
  // so the colouring is spelled out here rather than borrowed from DeltaBadge.
  const improved = deltaFromPrevious !== null && deltaFromPrevious < 0;

  return (
    <Card className={cn("border-border/60", improved && "dark:border-primary/40")}>
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
          {FACE_AGE_LABEL}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono text-4xl leading-none font-bold tabular-nums",
              improved && "text-primary dark:[text-shadow:0_0_18px_rgba(255,46,136,.6)]",
            )}
          >
            {skinAge}
          </span>
          {deltaFromPrevious !== null && (
            <span
              className={cn(
                "font-mono text-xs font-bold tracking-[0.12em] uppercase",
                deltaFromPrevious < 0 && "text-primary",
                deltaFromPrevious > 0 && "text-destructive",
                deltaFromPrevious === 0 && "text-muted-foreground",
              )}
            >
              {deltaFromPrevious === 0
                ? "No change"
                : `${deltaFromPrevious < 0 ? "−" : "+"}${years(deltaFromPrevious)}`}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {deltaFromPrevious === null
            ? "Your baseline — everything after this is measured against it."
            : "vs. your previous check-in"}
        </span>
      </CardContent>
    </Card>
  );
}
