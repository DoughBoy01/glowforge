import { cn } from "@/lib/utils";

/**
 * Inline SVG trend line for dense lists (concern trends, timeline rows).
 * Deliberately not a recharts chart — there can be a dozen-plus of these on
 * the progress page, and none of them need tooltips or client JS.
 */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className={cn("shrink-0", className)}
        aria-hidden
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--border)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  // Fixed 0-100 domain rather than min/max of the data: these sit next to
  // each other in a grid, and auto-scaling would make a 2-point wobble look
  // like the same movement as a 40-point swing.
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const y = height - (Math.max(0, Math.min(100, v)) / 100) * (height - 2) - 1;
      return `${(i * step).toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const trend = values.at(-1)! - values[0];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn(
        "shrink-0 overflow-visible",
        trend > 0 && "text-emerald-500",
        trend < 0 && "text-destructive",
        trend === 0 && "text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
