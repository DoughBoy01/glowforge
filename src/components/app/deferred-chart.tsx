"use client";

import dynamic from "next/dynamic";

/**
 * Recharts, loaded after the page is interactive instead of before it.
 *
 * Recharts is the largest single thing in this app's client bundle, and on the
 * home screen it draws one chart that sits below the fold — so paying for it
 * during first load means a phone downloads and parses the whole library before
 * it can respond to a tap, for a chart nobody has scrolled to yet. Everything
 * above the fold there (the face age hero, the day's board) is either server-
 * rendered or a few hundred bytes of state, so this was the one import standing
 * between the home screen and a fast first interaction.
 *
 * `ssr: false` is the operative part: with SSR left on, the chunk is still
 * required to hydrate and nothing is actually deferred. The trade is that the
 * chart is absent from the server HTML, hence the reserved-height skeleton — it
 * keeps the card the same size in both states so the arrival of the chart
 * doesn't shove the page around under a reading thumb.
 *
 * Only worth doing for charts below the fold. A deferred chart that *is* the
 * first thing on screen is just a slower chart.
 */
const TrendChart = dynamic(
  () => import("@/components/app/trend-chart").then((m) => m.TrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 w-full animate-pulse rounded-md bg-muted/30" aria-hidden />
    ),
  },
);

export function DeferredTrendChart({ data }: { data: { date: Date; score: number }[] }) {
  return <TrendChart data={data} />;
}
