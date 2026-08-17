import Link from "next/link";
import { auth } from "@/lib/auth";
import { ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScoreRing } from "@/components/app/score-ring";
import { MetricRail, type MetricRailItem } from "@/components/app/metric-rail";
import { DeferredTrendChart } from "@/components/app/deferred-chart";
import { ShareButton } from "@/components/app/share-button";
import { PartnerTeaser } from "@/components/app/partner-teaser";
import { AnalysisStatus } from "@/components/app/analysis-status";
import { CategoryPriorities } from "@/components/app/category-priorities";
import { ScoreLevelBadge } from "@/components/app/score-level-badge";
import { SectionHeading } from "@/components/app/section-heading";
import { StreakTile } from "@/components/app/streak-tile";
import { TodayHeading } from "@/components/app/today-heading";
import { TodayBoard } from "@/components/app/today-board";
import { FaceAgeHero } from "@/components/app/face-age-hero";
import { FirstScanPriming } from "@/components/app/first-scan-priming";
import { GoalPreview } from "@/components/app/goal-preview";
import { PrimeMoveCard } from "@/components/app/prime-move-card";
import { PromotionsPanel } from "@/components/app/promotions-panel";
import { DeltaBadge } from "@/components/app/delta-badge";
import { getDb } from "@/db";
import { getRecentScans, getMetricTrend, getFaceAgeReadings, getScanGoalContext } from "@/db/queries/scans";
import { getSimulationForScan } from "@/db/queries/skin-simulations";
import { getActiveRoutines, getCompletionsByRoutine, deriveRoutineProgress } from "@/db/queries/routines";
import { getFaceGymStats } from "@/db/queries/face-gym";
import {
  getActivePartnerLinks,
  getFeaturedPartnerLinks,
  partnerLinkForMetric,
} from "@/db/queries/partners";
import { TRACKED_METRICS, OVERALL_META, scoreForMetric, type MetricType, type TrackedMetric } from "@/lib/metrics";
import { getCategoryPriorities } from "@/lib/insights";
import { buildFaceAgeMission } from "@/lib/face-age";
import { goalLabel, resolveGoalPreview } from "@/lib/face-simulation";
import { buildTodayBoard } from "@/lib/home";
import { buildPrimeMove } from "@/lib/prime-move";
import { formatShortDate, todayLocalDate } from "@/lib/format";

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

  // One parallel batch, and deliberately nothing awaited after it. Every number
  // on this screen is derivable from these eight reads, so the page's time to
  // first byte is the slowest single query rather than the sum of two rounds —
  // which is what it was while the routine streaks were fetched per routine,
  // after the routine list they depended on had already come back.
  const [
    recentScans,
    overallTrend,
    routines,
    partnerLinks,
    featuredPromotions,
    faceGym,
    faceAgeReadings,
    completions,
  ] = await Promise.all([
    getRecentScans(db, userId!, SPARKLINE_SCANS),
    getMetricTrend(db, userId!, "overall", 30),
    getActiveRoutines(db, userId!),
    getActivePartnerLinks(db),
    getFeaturedPartnerLinks(db),
    getFaceGymStats(db, userId!),
    getFaceAgeReadings(db, userId!),
    getCompletionsByRoutine(db, userId!),
  ]);

  // Pinned once, so every routine on the screen is judged against the same
  // calendar day even if the render straddles midnight.
  const today = todayLocalDate();
  // Streaks and "done today" both fall out of the one completions read, which
  // also retires the separate query that used to answer the second question.
  const progress = new Map(
    routines.map((r) => [r.id, deriveRoutineProgress(completions, r.id, today)]),
  );
  const completedToday = routines.filter((r) => progress.get(r.id)!.doneToday).map((r) => r.id);

  const mission = buildFaceAgeMission(faceAgeReadings);

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

  const board = buildTodayBoard({
    lastScanAt: latest?.capturedAt ?? null,
    lastScanFailed: latest?.analysis?.status === "failed",
    routines,
    completedRoutineIds: completedToday,
    faceGym,
  });

  if (!latest) {
    return <FirstScanPriming />;
  }

  // The goal image panel. A second, dependent round trip rather than folded
  // into the batch above — it needs `latest.id`, which only exists once that
  // batch has resolved. Skipped for the empty-state return above, so a
  // brand-new user with zero scans doesn't pay for it.
  const [scanGoalContext, simulation] = await Promise.all([
    getScanGoalContext(db, userId!, latest.id),
    getSimulationForScan(db, userId!, latest.id),
  ]);
  // No simulation row, and the analysis that would have chained into one
  // finished a while ago: nothing is coming. Distinguishes "still generating,
  // worth a spinner" from "never will be, worth nothing" — without this, a
  // dashboard revisit for an old check-in from before this feature shipped
  // would show a loading card that polls for two minutes and then vanishes,
  // every single time.
  const simulationStale =
    !simulation &&
    latest.analysis?.status === "succeeded" &&
    latest.analysis.completedAt !== null &&
    Date.now() - latest.analysis.completedAt.getTime() > 10 * 60_000;
  const showGoalPreview =
    scanGoalContext.hasFrontPhoto && latest.analysis?.status !== "failed" && !simulationStale;
  const goalPreview = showGoalPreview
    ? resolveGoalPreview({ simulation, concernScores: scanGoalContext.concernScores, priorities })
    : null;

  // Same input as the results page's card, so the two never disagree about
  // what the one move is — it's derived from the latest scan on both.
  const primeMove = buildPrimeMove(priorities, scanGoalContext.concernScores);

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
    // `stagger` reveals the sections in sequence on arrival rather than
    // painting the whole stack at once — one orchestrated entrance, nothing
    // that loops, and inert under prefers-reduced-motion.
    <div className="stagger mx-auto flex w-full max-w-5xl flex-col gap-4 md:gap-6">
      {/* Two different jobs, so two different headers. A phone gets a dated
          "Today" — the screen answers what to do now, which is not what a
          desktop dashboard is for. Desktop keeps the overview title and the
          action row it has the width for. Exactly one h1 is in the a11y tree
          at any width; the other is display:none. */}
      <TodayHeading />
      <div className="hidden flex-wrap items-center justify-between gap-4 md:flex">
        <h1 className="text-3xl leading-none">Overview</h1>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href={`/scans/${latest.id}`}>View results</Link>} />
          {mission.state === "ahead" && <ShareButton scanId={latest.id} />}
          <Button render={<Link href="/check-in">New check-in</Link>} />
        </div>
      </div>

      <AnalysisStatus scanId={latest.id} initialStatus={latest.analysis?.status ?? null} />

      {/* The mission first, then the work that feeds it, then the diagnostics.
          The composite score used to sit here — but a 0-100 number has no
          natural target, while "fewer years than you started with" does, so the
          ring moved below the fold to sit with the other measurements it belongs
          to. */}
      <FaceAgeHero mission={mission} />

      <TodayBoard board={board} />

      {/* Under today's work, above the diagnostics. The board is what to do
          with what you already own; this is the single thing worth buying,
          and it stays on the home screen between scans because "go to Boots"
          is not an errand most people run the same evening they read it. */}
      {primeMove && (
        <PrimeMoveCard
          move={primeMove}
          partner={partnerLinkForMetric(partnerLinks, primeMove.metric)}
        />
      )}

      {/* Right under the prime move — the highest-traffic real estate on the
          page, so only rows someone deliberately marked `isFeatured` earn a
          place here rather than every partner row that exists. */}
      <PromotionsPanel promotions={featuredPromotions} />

      <section className="flex flex-col gap-3">
        <SectionHeading>Diagnostics</SectionHeading>
        <div
          className={cn(
            "grid gap-4",
            previous ? "md:grid-cols-[auto_1fr]" : "md:mx-auto md:max-w-sm",
          )}
        >
          <Link
            href={`/scans/${latest.id}`}
            className="block outline-none rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card className="press h-full md:justify-center">
              <CardContent className="flex flex-col items-center gap-3">
                <ScoreRing
                  score={overall ?? 0}
                  label={OVERALL_META.label}
                  className="size-40 md:size-35"
                />
                <ScoreLevelBadge score={overall ?? 0} />
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
                  <DeltaBadge delta={overallDelta} emptyLabel="Baseline" />
                  {previous && (
                    <span className="text-muted-foreground">
                      since {formatShortDate(previous.capturedAt)}
                    </span>
                  )}
                </div>
                {/* Says what the ring is *for*, which the number alone doesn't.
                    These four scores are the diagnosis behind the face age above —
                    the reason it moved, not a second scoreboard. */}
                <p className="max-w-[16rem] text-center text-xs text-balance text-muted-foreground">
                  What&apos;s driving your face age — the four things the scan grades.
                </p>
                <span className="flex items-center gap-1 font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
                  Full results <ChevronRight className="size-3.5" />
                </span>
              </CardContent>
            </Card>
          </Link>

          {/* Nothing to plot yet on a first scan — the chart's own "log
              another check-in" fallback is correct but showing that fallback
              at all is still second-scan chrome on a first-scan visit, so the
              card is omitted rather than rendered empty. */}
          {previous && (
            <Card className="border-border/60">
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
                <DeferredTrendChart
                  data={overallTrend.map((row) => ({
                    date: row.capturedAt,
                    score: row.score,
                  }))}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Same card as the results page, same reasoning for keeping it here:
          this is the goal made visible, and a goal worth persisting toward
          is worth seeing on every visit, not just the day it was scanned. */}
      {goalPreview && (
        <GoalPreview
          scanId={latest.id}
          status={simulation?.status ?? null}
          goalLabel={goalLabel(goalPreview.goal)}
          summary={goalPreview.summary}
          params={goalPreview.params}
          horizonWeeks={goalPreview.goal.horizonWeeks}
        />
      )}

      <section className="flex flex-col gap-3">
        <SectionHeading>Breakdown</SectionHeading>
        <MetricRail items={metricItems} />
      </section>

      <CategoryPriorities priorities={priorities} />

      {/* Routine dropped from here: streak-gamifying "0 days / no routines
          yet" pushed a habit loop this audience doesn't form. Face Gym earns
          the treatment — it's the one daily action logged in-place from the
          Today board above, not a save/build commitment. */}
      <section className="flex flex-col gap-3">
        <SectionHeading>Streak</SectionHeading>
        <div className="sm:max-w-xs">
          <StreakTile
            href="/face-gym"
            label="Face Gym"
            days={faceGym.streak}
            footer={
              faceGym.totalSessions
                ? `${faceGym.totalSessions} session${faceGym.totalSessions > 1 ? "s" : ""} · best ${faceGym.bestStreak}d`
                : "Never trained"
            }
          />
        </div>
      </section>

      <PartnerTeaser links={partnerLinks} />

      {/* The board at the top owns check-in and the hero opens the full
          results, so sharing is the one action left worth a button at the end
          of the scroll, where the thumb already is. Only once there's
          something worth sharing — see the header's ShareButton above. */}
      {mission.state === "ahead" && (
        <ShareButton scanId={latest.id} className="w-full md:hidden" />
      )}
    </div>
  );
}
