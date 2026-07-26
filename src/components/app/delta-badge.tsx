import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A signed change, coloured by whether it's *good* rather than by sign —
 * skin age going down is an improvement, every score metric going up is.
 * Pass `lowerIsBetter` for the former.
 */
export function DeltaBadge({
  delta,
  lowerIsBetter = false,
  emptyLabel = "—",
  className,
}: {
  delta: number | null;
  lowerIsBetter?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  if (delta === null) {
    return (
      <span className={cn("font-mono text-xs text-muted-foreground", className)}>
        {emptyLabel}
      </span>
    );
  }

  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  const worsened = lowerIsBetter ? delta > 0 : delta < 0;
  const Icon = delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-mono text-xs font-medium tabular-nums",
        improved && "text-emerald-500",
        worsened && "text-destructive",
        delta === 0 && "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3" />
      {delta > 0 ? `+${delta}` : delta === 0 ? "0" : delta}
    </span>
  );
}
