"use client";

import { Line, LineChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { FACE_AGE_LABEL } from "@/lib/face-age";
import { formatShortDate } from "@/lib/format";

const chartConfig = {
  faceAge: { label: FACE_AGE_LABEL, color: "var(--primary)" },
} satisfies ChartConfig;

/**
 * Face age across every analysed check-in — the mission's own line.
 *
 * Two things set it apart from the score charts. It isn't pinned to a 0-100
 * domain, because the interesting range is a few years wide, so it's scaled to
 * the user's own values with padding. And it draws the baseline as a marked
 * reference line, which is what turns a wiggle into a scoreboard: below that
 * line is the whole objective, and without it a reader has no way to tell a good
 * chart from a bad one.
 *
 * Drawn in the primary colour rather than a chart palette slot, because this is
 * the one series in the app that *is* the product's goal.
 */
export function FaceAgeChart({ points }: { points: { date: Date; score: number }[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Two analysed check-ins are needed before there&apos;s a trend to draw.
      </div>
    );
  }

  const values = points.map((p) => p.score);
  const baseline = values[0];
  // Padded to include the baseline even when every later reading sits well
  // clear of it — otherwise the reference line ends up outside the domain and
  // silently disappears, taking the chart's only point of comparison with it.
  const min = Math.max(0, Math.min(...values, baseline) - 2);
  const max = Math.max(...values, baseline) + 2;

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <LineChart
        data={points.map((p) => ({ label: formatShortDate(p.date), faceAge: p.score }))}
        margin={{ left: 0, right: 12, top: 12, bottom: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis domain={[min, max]} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ReferenceLine
          y={baseline}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          label={{
            value: "baseline",
            position: "insideTopLeft",
            fill: "var(--muted-foreground)",
            fontSize: 10,
          }}
        />
        <Line
          type="monotone"
          dataKey="faceAge"
          stroke="var(--color-faceAge)"
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
