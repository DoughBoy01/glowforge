import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeftRight, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScoreRing } from "@/components/app/score-ring";
import { MetricCard } from "@/components/app/metric-card";
import { ScoreLevelBadge } from "@/components/app/score-level-badge";
import { FaceAgeBadge } from "@/components/app/face-age-badge";
import { ShareButton } from "@/components/app/share-button";
import { AnalysisStatus } from "@/components/app/analysis-status";
import { ResultsAnalyzing } from "@/components/app/results-analyzing";
import { TechnicalBreakdown } from "@/components/app/technical-breakdown";
import { ScoreProjection } from "@/components/app/score-projection";
import { GoalPreview } from "@/components/app/goal-preview";
import { DailyRoutinePlan } from "@/components/app/daily-routine";
import { getDb } from "@/db";
import { getScanById, getPreviousScan } from "@/db/queries/scans";
import { getSimulationForScan } from "@/db/queries/skin-simulations";
import { TRACKED_METRICS, METRIC_META, OVERALL_META, scoreForMetric, trackedScores } from "@/lib/metrics";
import { getCategoryPriorities, getProjectedScores, getSkinAgeInsight } from "@/lib/insights";
import { goalLabel, resolveGoalPreview } from "@/lib/face-simulation";
import { buildDailyRoutines } from "@/lib/daily-routine";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Results" };

export default async function ScanResultsPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { userId } = await auth();
  const { scanId } = await params;
  const db = getDb();

  const scan = await getScanById(db, userId!, scanId);
  if (!scan) notFound();

  const previous = await getPreviousScan(db, userId!, scan.capturedAt);

  const latestScores = trackedScores(scan.metricScores);
  const previousScores = previous ? trackedScores(previous.metricScores) : null;

  const overall = scoreForMetric(scan.metricScores, "overall");
  const priorities = latestScores ? getCategoryPriorities(latestScores, previousScores) : [];
  const projected = priorities.length ? getProjectedScores(priorities) : [];
  const dailyRoutines = priorities.length
    ? buildDailyRoutines(priorities, scan.analysis?.concernScores ?? [])
    : [];

  const frontPhoto = scan.photos.find((p) => p.angle === "front");

  const aiStatus = scan.analysis?.status ?? null;
  const aiFailed = aiStatus === "failed";
  const aiSucceeded = aiStatus === "succeeded";
  // A front photo always triggers requestSkinAnalysis (see check-in/actions.ts), but that fires
  // via ctx.waitUntil — the pending analysis row isn't guaranteed to be committed yet by the time
  // this page's first render lands right after the redirect. Treat "no analysis row, but a photo
  // was submitted" the same as "pending" so we show the analyzing state instead of a blank page.
  const aiInFlight = aiStatus === "pending" || aiStatus === "processing" || (aiStatus === null && !!frontPhoto);

  const skinAgeInsight =
    aiSucceeded && scan.analysis?.skinAge != null
      ? getSkinAgeInsight(
          scan.analysis.skinAge,
          previous?.analysis?.status === "succeeded" ? (previous.analysis.skinAge ?? null) : null,
        )
      : null;

  const concernScores = scan.analysis?.concernScores.map((c) => ({
    concern: c.concern,
    uiScore: c.uiScore,
    hasMask: c.maskUrl != null,
  })) ?? [];

  // The goal image.
  const simulation = frontPhoto ? await getSimulationForScan(db, userId!, scan.id) : null;
  const goalPreview = resolveGoalPreview({
    simulation,
    concernScores: scan.analysis?.concernScores ?? [],
    priorities,
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {/* The app bar already reads "Results" on mobile. */}
          <h1 className="sr-only text-2xl font-bold tracking-tight md:not-sr-only">Your results</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(scan.capturedAt)}
            {previous ? ` · vs your ${formatDate(previous.capturedAt)} check-in` : " · Your first scan"}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {previous && (
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              render={
                <Link href={`/scans/compare?from=${previous.id}&to=${scan.id}`}>
                  <ArrowLeftRight className="size-4" />
                  Compare
                </Link>
              }
            />
          )}
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            render={<Link href="/scans">All check-ins</Link>}
          />
        </div>
      </div>

      {aiInFlight && !latestScores && (
        <ResultsAnalyzing scanId={scan.id} initialStatus={aiStatus ?? "pending"} />
      )}

      {aiFailed && !latestScores && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <TriangleAlert className="size-8 text-destructive" />
            <div className="font-semibold">We couldn&apos;t analyze that photo</div>
            <p className="max-w-sm text-sm text-muted-foreground">
              {scan.analysis?.errorMessage ?? "Something went wrong during analysis."}
            </p>
            <Button render={<Link href="/check-in">Try another check-in</Link>} />
          </CardContent>
        </Card>
      )}

      {latestScores && (
        <>
          {aiStatus && aiStatus !== "succeeded" && (
            <AnalysisStatus scanId={scan.id} initialStatus={aiStatus} />
          )}

          <div className="grid gap-4 md:grid-cols-[auto_1fr]">
            <Card className="flex flex-col items-center justify-center gap-4 border-border/60 p-6">
              {frontPhoto && (
                <Image
                  src={`/api/photos/${scan.id}/front`}
                  alt=""
                  width={112}
                  height={112}
                  className="size-28 rounded-full object-cover ring-1 ring-border/60"
                />
              )}
              <ScoreRing
                score={overall ?? 0}
                label={OVERALL_META.label}
                className="size-40 md:size-30"
              />
              <ScoreLevelBadge score={overall ?? 0} />
            </Card>
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle>What we found</CardTitle>
                <CardDescription>Your four tracked categories from this check-in.</CardDescription>
              </CardHeader>
              {priorities[0] && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Biggest opportunity:{" "}
                    <span className="font-medium text-foreground">
                      {METRIC_META[priorities[0].metric].label}
                    </span>{" "}
                    — {priorities[0].guidance}
                  </p>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Above the four metric cards, not fifth in the row with them. This
              is what the check-in was for; those are the reasons behind it. */}
          {skinAgeInsight && <FaceAgeBadge insight={skinAgeInsight} />}

          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            {TRACKED_METRICS.map((metric) => (
              <MetricCard
                key={metric}
                metric={metric}
                score={latestScores[metric]}
                previousScore={previousScores?.[metric] ?? null}
              />
            ))}
          </div>

          {concernScores.length > 0 && (
            <TechnicalBreakdown concerns={concernScores} scanId={scan.id} />
          )}

          {/* The goal, twice: once as a picture and once as numbers. The
              image is the one people feel; the bars are the one they can
              check against their next scan. Neither replaces the other, and
              the image never appears without them. */}
          {/* Not when the analysis failed: the simulation is chained off a
              successful one, so no row will ever appear and the card would
              sit there loading forever. A user with manual scores and a
              failed analysis reaches this branch, which is the only way that
              combination happens. */}
          {frontPhoto && !aiFailed && (
            <GoalPreview
              scanId={scan.id}
              status={simulation?.status ?? null}
              goalLabel={goalLabel(goalPreview.goal)}
              summary={goalPreview.summary}
              params={goalPreview.params}
              horizonWeeks={goalPreview.goal.horizonWeeks}
            />
          )}

          {projected.length > 0 && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle>Where you could be</CardTitle>
                <CardDescription>
                  Projected after ~8-12 weeks of consistent routine — grounded in your own scores,
                  not a guarantee.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScoreProjection scores={projected} />
              </CardContent>
            </Card>
          )}

          {dailyRoutines.length > 0 && (
            <DailyRoutinePlan
              routines={dailyRoutines}
              scanId={scan.id}
              description="Built from this check-in and ordered the way you actually run it. Save it and we'll track it for you."
            />
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <ShareButton scanId={scan.id} className="w-full sm:w-auto" />
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              render={<Link href="/dashboard">View dashboard</Link>}
            />
          </div>
        </>
      )}

      {aiSucceeded && !latestScores && (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="font-semibold">Partial results</div>
            <p className="max-w-sm text-sm text-muted-foreground">
              We analyzed your photo but couldn&apos;t calculate a full score breakdown from it.
              {concernScores.length > 0
                ? " Here's the raw detail we could detect:"
                : " Try another check-in with a clearer, front-facing photo."}
            </p>
            {concernScores.length === 0 && (
              <Button render={<Link href="/check-in">Try another check-in</Link>} />
            )}
          </CardContent>
        </Card>
      )}

      {!latestScores && concernScores.length > 0 && (
        <TechnicalBreakdown concerns={concernScores} scanId={scan.id} />
      )}

      {!latestScores && !aiInFlight && !aiFailed && concernScores.length === 0 && (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No scores yet for this check-in.{" "}
            <Link href="/check-in" className="font-medium text-foreground underline underline-offset-2">
              Start a new one
            </Link>
            .
          </CardContent>
        </Card>
      )}
    </div>
  );
}
