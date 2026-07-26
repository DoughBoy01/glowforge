import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ArrowRight, ChevronRight, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScoreRing } from "@/components/app/score-ring";
import { MetricRail, type MetricRailItem } from "@/components/app/metric-rail";
import { TrendChart } from "@/components/app/trend-chart";
import { ShareButton } from "@/components/app/share-button";
import { PartnerTeaser } from "@/components/app/partner-teaser";
import { AnalysisStatus } from "@/components/app/analysis-status";
import { CategoryPriorities } from "@/components/app/category-priorities";
import { TodayHeading } from "@/components/app/today-heading";
import { NextActionCard } from "@/components/app/next-action-card";
import { DeltaBadge } from "@/components/app/delta-badge";
import { getDb } from "@/db";
import { getRecentScans, getMetricTrend } from "@/db/queries/scans";
import {
  getActiveRoutines,
  getRoutineStreak,
  getRoutineIdsCompletedOn,
} from "@/db/queries/routines";
import { getActivePartnerLinks } from "@/db/queries/partners";
import { TRACKED_METRICS, OVERALL_META, scoreForMetric, type MetricType, type TrackedMetric } from "@/lib/metrics";
import { getCategoryPriorities, getSkinAgeInsight } from "@/lib/insights";
import { getNextAction } from "@/lib/home";
import { formatShortDate } from "@/lib/format";

export const metadata = { title: "Home" };

/**
 * How much history the metric sparklines draw. Also supplies "latest" and
 * "previous" for every delta on the screen, so one query feeds the whole
 * page rather than one per metric.
 */
const SPARKLINE_SCANS = 12;

function scoreFor(scan: { metricScores: { metricType: string; score: number }[] } | undefined, type: MetricType) {
  return scoreForMetric(scan?.metricScores, type);
}

export default async function HomePage() {
  const { userId } = await auth();
  const db = getDb();

  const [recentScans, overallTrend, routines, partnerLinks, completedToday] = await Promise.all([
    getRecentScans(db, userId!, SPARKLINE_SCANS),
    getMetricTrend(db, userId!, "overall", 30),
    getActiveRoutines(db, userId!),
    getActivePartnerLinks(db),
    getRoutineIdsCompletedOn(db, userId!),
  ]);

  const [latest, previous] = recentScans;
  const overall = scoreFor(latest, "overall");
  const previousOverall = scoreFor(previous, "overall");
  const overallDelta =
    overall !== null && previousOverall !== null ? overall - previousOverall : null;

  const latestScores = Object.fromEntries(
    TRACKED_METRICS.map((m) => [m, scoreFor(latest, m) ?? 0]),
  ) as Record<TrackedMetric, number>;
  const previousScores = previous
    ? (Object.fromEntries(
        TRACKED_METRICS.map((m) => [m, scoreFor(previous, m) ?? 0]),
      ) as Record<TrackedMetric, number>)
    : null;
  const priorities = latest ? getCategoryPriorities(latestScores, previousScores) : [];

  const skinAgeInsight =
    latest?.analysis?.status === "succeeded" && latest.analysis.skinAge !== null
      ? getSkinAgeInsight(
          latest.analysis.skinAge,
          previous?.analysis?.status === "succeeded" ? (previous.analysis.skinAge ?? null) : null,
        )
      : null;

  const streaks = await Promise.all(
    routines.map((r) => getRoutineStreak(db, userId!, r.id)),
  );
  const bestStreak = streaks.length ? Math.max(...streaks) : 0;

  const nextAction = getNextAction({
    lastScanAt: latest?.capturedAt ?? null,
    routineCount: routines.length,
    routinesLoggedToday: routines.filter((r) => completedToday.includes(r.id)).length,
  });

  if (!latest) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center md:py-24">
        <h1 className="text-2xl font-bold">Log your baseline</h1>
        <p className="text-sm text-muted-foreground">
          Your first check-in sets the line everything else is measured against. Takes under
          two minutes.
        </p>
        <Button
          size="lg"
          className="w-full sm:w-auto"
          render={
            <Link href="/check-in">
              Start check-in <ArrowRight className="size-4" />
            </Link>
          }
        />
      </div>
    );
  }

  // Oldest-first, so the sparklines read left-to-right like every other
  // chart in the app.
  const chronological = [...recentScans].reverse();
  const metricItems: MetricRailItem[] = TRACKED_METRICS.map((metric) => ({
    metric,
    score: scoreFor(latest, metric) ?? 0,
    previousScore: scoreFor(previous, metric),
    history: chronological
      .map((scan) => scoreForMetric(scan.metricScores, metric))
      .filter((score): score is number => score !== null),
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 md:gap-6">
      {/* Two different jobs, so two different headers. A phone gets a dated
          "Today" — the screen answers what to do now, which is not what a
          desktop dashboard is for. Desktop keeps the overview title and the
          action row it has the width for. Exactly one h1 is in the a11y tree
          at any width; the other is display:none. */}
      <TodayHeading />
      <div className="hidden flex-wrap items-center justify-between gap-4 md:flex">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href={`/scans/${latest.id}`}>View results</Link>} />
          <ShareButton scanId={latest.id} />
          <Button render={<Link href="/check-in">New check-in</Link>} />
        </div>
      </div>

      <AnalysisStatus scanId={latest.id} initialStatus={latest.analysis?.status ?? null} />

      {/* `order` rather than two separate trees: a phone reads score → what
          to do → the chart, while desktop puts score and chart side by side
          and drops the prompt underneath. */}
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <Link
          href={`/scans/${latest.id}`}
          className="order-1 block outline-none md:rounded-xl md:focus-visible:ring-3 md:focus-visible:ring-ring/50"
        >
          {/* Full-bleed band on a phone: this is the whole first screen, and
              insetting it by a gutter wastes the width the ring wants. */}
          <Card className="press -mx-4 h-full rounded-none ring-0 [--card-spacing:--spacing(6)] md:mx-0 md:justify-center md:rounded-xl md:ring-1">
            <CardContent className="flex flex-col items-center gap-3">
              <ScoreRing
                score={overall ?? 0}
                label={OVERALL_META.label}
                className="size-48 md:size-35"
              />
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
                <DeltaBadge delta={overallDelta} emptyLabel="Baseline" />
                {previous && (
                  <span className="text-muted-foreground">
                    since {formatShortDate(previous.capturedAt)}
                  </span>
                )}
              </div>
              {skinAgeInsight && (
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  Skin age {skinAgeInsight.skinAge}
                </span>
              )}
              <span className="flex items-center gap-1 font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase md:hidden">
                Full results <ChevronRight className="size-3.5" />
              </span>
            </CardContent>
          </Card>
        </Link>

        <NextActionCard action={nextAction} className="order-2 md:order-3 md:col-span-2" />

        <Card className="order-3 border-border/60 md:order-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Overall trend</CardTitle>
              <CardDescription>Last 30 check-ins</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              render={
                <Link href="/scans">
                  <span className="max-sm:sr-only">Full history</span>
                  <ArrowRight className="size-4" />
                </Link>
              }
            />
          </CardHeader>
          <CardContent>
            <TrendChart
              data={overallTrend.map((row) => ({
                date: row.capturedAt,
                score: row.score,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <MetricRail items={metricItems} />

      <CategoryPriorities priorities={priorities} />

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="min-w-0">
            <CardTitle>Routine streak</CardTitle>
            <CardDescription>
              {routines.length
                ? `${routines.length} active routine${routines.length > 1 ? "s" : ""}`
                : "No routines yet"}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2 font-mono text-2xl font-bold">
            <Flame className="size-6 text-primary" />
            {bestStreak}
          </div>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            render={<Link href="/routine">Manage routine</Link>}
          />
        </CardContent>
      </Card>

      <PartnerTeaser links={partnerLinks} />

      {/* The tab bar owns check-in and the hero opens the full results, so
          sharing is the one action left worth a button at the end of the
          scroll, where the thumb already is. */}
      <ShareButton scanId={latest.id} className="w-full md:hidden" />
    </div>
  );
}
