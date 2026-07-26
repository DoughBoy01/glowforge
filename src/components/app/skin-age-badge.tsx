import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SkinAgeInsight } from "@/lib/insights";

export function SkinAgeBadge({ insight }: { insight: SkinAgeInsight }) {
  const { skinAge, deltaFromPrevious } = insight;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          AI Skin Age
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold tabular-nums">{skinAge}</span>
          {deltaFromPrevious !== null && (
            <span
              className={cn(
                "font-mono text-xs font-medium",
                deltaFromPrevious < 0 && "text-emerald-500",
                deltaFromPrevious > 0 && "text-destructive",
                deltaFromPrevious === 0 && "text-muted-foreground",
              )}
            >
              {deltaFromPrevious === 0
                ? "No change"
                : deltaFromPrevious < 0
                  ? `${deltaFromPrevious}`
                  : `+${deltaFromPrevious}`}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
