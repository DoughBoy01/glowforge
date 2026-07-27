import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeftRight, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MetricTrendChart } from "@/components/app/metric-trend-chart";
import { FaceAgeChart } from "@/components/app/face-age-chart";
import { ConcernTrends } from "@/components/app/concern-trends";
import { ScanTimeline } from "@/components/app/scan-timeline";
import { DeltaBadge } from "@/components/app/delta-badge";
import { ScoreLevelBadge } from "@/components/app/score-level-badge";
import { getDb } from "@/db";
import { getScanHistory, countScans, getConcernScoresForScans } from "@/db/queries/scans";
import {
  buildProgressSummary,
  buildChartRows,
  buildFaceAgeSeries,
  buildConcernTrends,
} from "@/lib/progress";
import { FACE_AGE_LABEL, FACE_AGE_MISSION } from "@/lib/face-age";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Progress" };

/**
 * How many check-ins one view covers. Doubles as the trend window and the
 * timeline page size, so the charts and the list below them always describe
 * exactly the same set of scans — a chart drawn over a different range than
 * the rows beneath it is worse than no chart.
 *
 * Also bounded by D1's 100-bound-parameter statement limit, which
 * `getConcernScoresForScans` runs into via its `inArray` of scan ids.
 */
const PAGE_SIZE = 60;

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { userId } = await auth();
  const db = getDb();

  const { page: pageParam } = await searchParams;
  const page = Math.max(0, Number.parseInt(pageParam ?? "0", 10) || 0);

  const [history, totalScans] = await Promise.all([
    getScanHistory(db, userId!, { limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    countScans(db, userId!),
  ]);

  if (!history.length) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
        <h1 className="text-2xl font-bold">
          {page > 0 ? "Nothing further back" : "No check-ins yet"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {page > 0
            ? "You've reached the start of your history."
            : "Your progress history starts with your first check-in. Takes under two minutes."}
        </p>
        <Button
          render={
            <Link href={page > 0 ? "/scans" : "/check-in"}>
              {page > 0 ? "Back to latest" : "Start check-in"}
              <ArrowRight className="size-4" />
            </Link>
          }
        />
      </div>
    );
  }

  const concernRows = await getConcernScoresForScans(
    db,
    userId!,
    history.map((s) => s.id),
  );

  const summary = buildProgressSummary(history, totalScans);
  const chartRows = buildChartRows(history);
  const faceAgeSeries = buildFaceAgeSeries(history);
  const concernTrends = buildConcernTrends(concernRows, history);

  const windowStart = summary.firstScanAt;
  const hasOlder = (page + 1) * PAGE_SIZE < totalScans;
  const rangeStart = page * PAGE_SIZE + 1;
  const rangeEnd = page * PAGE_SIZE + history.length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
          <p className="text-sm text-muted-foreground">
            {totalScans} check-in{totalScans === 1 ? "" : "s"}
            {summary.daysTracked > 0 && ` · ${summary.daysTracked} days of history in view`}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {history.length > 1 && (
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              render={
                <Link href={`/scans/compare?from=${history.at(-1)!.id}&to=${history[0].id}`}>
                  <ArrowLeftRight className="size-4" />
                  Compare
                </Link>
              }
            />
          )}
          {/* Visible at every width: check-in left the tab bar when the cadence
              went to four weeks, so this and the home board are how it's
              reached now. */}
          <Button className="flex-1 sm:flex-none" render={<Link href="/check-in">New check-in</Link>} />
        </div>
      </div>

      {/* Ahead of the score stats, not after them. This page's job is to answer
          "is it working?", and the score cards below are the follow-up question
          of "why". */}
      {faceAgeSeries.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>{FACE_AGE_LABEL}</CardTitle>
            <CardDescription>
              {FACE_AGE_MISSION} Estimated from each analysed photo and only ever compared
              against your own history — never against your real age, which we don&apos;t ask for.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FaceAgeChart points={faceAgeSeries} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          label="Overall now"
          value={summary.overall.current}
          footer={
            summary.overall.allTimeDelta !== null && windowStart
              ? `since ${formatDate(windowStart)}`
              : "Your baseline"
          }
          delta={summary.overall.allTimeDelta}
          showLevel
        />
        <StatCard
          label="Last 30 days"
          value={summary.overall.current}
          footer={
            summary.overall.windowDelta !== null
              ? "vs. 30 days ago"
              : "Needs a check-in 30+ days apart"
          }
          delta={summary.overall.windowDelta}
        />
        <StatCard
          label="Since last check-in"
          value={summary.overall.current}
          footer={summary.overall.lastDelta !== null ? "vs. previous scan" : "First scan in view"}
          delta={summary.overall.lastDelta}
        />
        {/* Two label/value rows don't fit half a phone's width, so this one
            takes the full row while the three numeric cards pair up. */}
        <Card className="col-span-2 border-border/60 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Biggest mover
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {summary.biggestGain || summary.biggestDrop ? (
              <>
                {summary.biggestGain && (
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm">{summary.biggestGain.label}</span>
                    <DeltaBadge delta={summary.biggestGain.allTimeDelta} />
                  </div>
                )}
                {summary.biggestDrop && (
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm">{summary.biggestDrop.label}</span>
                    <DeltaBadge delta={summary.biggestDrop.allTimeDelta} />
                  </div>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                Log another check-in to see what&apos;s moving.
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Score history</CardTitle>
          <CardDescription>
            What&apos;s driving the line above. Every check-in in view, plotted on the date it was
            captured — switch metrics to see which category is doing the work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MetricTrendChart rows={chartRows} />
        </CardContent>
      </Card>

      <ConcernTrends trends={concernTrends} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
          <h2 className="text-lg font-semibold tracking-tight">All check-ins</h2>
          <span className="font-mono text-xs text-muted-foreground">
            {rangeStart}–{rangeEnd} of {totalScans}
          </span>
        </div>
        <ScanTimeline scans={history} />
      </div>

      {(hasOlder || page > 0) && (
        <div className="flex items-center justify-between gap-2">
          {page > 0 ? (
            <Button
              variant="outline"
              size="lg"
              className="flex-1 sm:flex-none"
              render={
                <Link href={page === 1 ? "/scans" : `/scans?page=${page - 1}`}>
                  <ChevronLeft className="size-4" />
                  Newer
                </Link>
              }
            />
          ) : (
            <span />
          )}
          {hasOlder && (
            <Button
              variant="outline"
              size="lg"
              className="flex-1 sm:flex-none"
              render={
                <Link href={`/scans?page=${page + 1}`}>
                  Older
                  <ChevronRight className="size-4" />
                </Link>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  footer,
  delta,
  showLevel = false,
}: {
  label: string;
  value: number | null;
  footer: string;
  delta: number | null;
  showLevel?: boolean;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold tabular-nums">{value ?? "—"}</span>
          <DeltaBadge delta={delta} />
        </div>
        {showLevel && value !== null && <ScoreLevelBadge score={value} />}
        <span className="text-xs text-muted-foreground">{footer}</span>
      </CardContent>
    </Card>
  );
}
