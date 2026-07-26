"use client";

import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatShortDate } from "@/lib/format";

const chartConfig = {
  skinAge: { label: "Skin age", color: "var(--chart-3)" },
} satisfies ChartConfig;

/**
 * Estimated skin age across every analyzed check-in. Unlike the score
 * charts this isn't pinned to a 0-100 domain — the interesting range is a
 * few years wide, so it's scaled to the user's own values with padding.
 */
export function SkinAgeChart({ points }: { points: { date: Date; score: number }[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Two analyzed check-ins are needed before skin age has a trend.
      </div>
    );
  }

  const values = points.map((p) => p.score);
  const min = Math.max(0, Math.min(...values) - 2);
  const max = Math.max(...values) + 2;

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <LineChart
        data={points.map((p) => ({ label: formatShortDate(p.date), skinAge: p.score }))}
        margin={{ left: 0, right: 12, top: 12, bottom: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis domain={[min, max]} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          type="monotone"
          dataKey="skinAge"
          stroke="var(--color-skinAge)"
          strokeWidth={2}
          dot={{ r: 3 }}
          // See metric-trend-chart: recharts' draw animation strands the
          // path mid-transition here and the line never renders.
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
