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
  score: {
    label: "Score",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

export function TrendChart({
  data,
}: {
  data: { date: Date; score: number }[];
}) {
  if (data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Log at least two check-ins to see a trend.
      </div>
    );
  }

  const points = data.map((d) => ({
    label: formatShortDate(d.date),
    score: d.score,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <LineChart data={points} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={28} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="var(--color-score)"
          strokeWidth={2}
          dot={false}
          // Recharts' line-draw animation intermittently strands the path
          // at a zero-length stroke-dasharray, leaving the card blank.
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
