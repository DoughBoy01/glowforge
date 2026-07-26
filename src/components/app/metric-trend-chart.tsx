"use client";

import { useState } from "react";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TRACKED_METRICS,
  METRIC_META,
  OVERALL_META,
  type MetricType,
} from "@/lib/metrics";
import { formatShortDate } from "@/lib/format";

const chartConfig = {
  overall: { label: OVERALL_META.short, color: OVERALL_META.chartVar },
  ...Object.fromEntries(
    TRACKED_METRICS.map((m) => [
      m,
      { label: METRIC_META[m].short, color: METRIC_META[m].chartVar },
    ]),
  ),
} satisfies ChartConfig;

const TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "overall", label: OVERALL_META.short },
  ...TRACKED_METRICS.map((m) => ({ value: m, label: METRIC_META[m].short })),
];

export type MetricChartRow = { date: Date } & Partial<Record<MetricType, number | null>>;

/**
 * The full score history, one line per metric. Defaults to the overall
 * composite; "All" overlays every metric so a user can see which category
 * is actually driving a move in the headline number.
 */
export function MetricTrendChart({ rows }: { rows: MetricChartRow[] }) {
  const [tab, setTab] = useState<string>("overall");

  const visible: MetricType[] =
    tab === "all" ? ["overall", ...TRACKED_METRICS] : [tab as MetricType];

  const points = rows.map((row) => ({
    ...row,
    label: formatShortDate(row.date),
  }));

  // A single point is a dot on an empty grid — say what's missing instead.
  const plotted = visible.some(
    (m) => points.filter((p) => p[m] != null).length >= 2,
  );

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <TabsList className="flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {plotted ? (
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <LineChart data={points} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={28} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {tab === "all" && <ChartLegend content={<ChartLegendContent />} />}
            {visible.map((metric) => (
              <Line
                key={metric}
                type="monotone"
                dataKey={metric}
                stroke={`var(--color-${metric})`}
                strokeWidth={2}
                dot={false}
                // Scans whose AI analysis hasn't landed have no score for a
                // metric; bridge the gap rather than breaking the line.
                connectNulls
                // Recharts' line-draw animation strands the path at a
                // stroke-dasharray of either 0 or full length here — lines
                // added on a tab switch never appear at all. The chart is
                // the whole point of the page, so correctness over motion.
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      ) : (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Log at least two check-ins with this metric scored to see a trend.
        </div>
      )}
    </div>
  );
}
