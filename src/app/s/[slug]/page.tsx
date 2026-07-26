import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreRing } from "@/components/app/score-ring";
import { getDb } from "@/db";
import { getShareBySlug, incrementShareViewCount } from "@/db/queries/shares";
import { TRACKED_METRICS, METRIC_META, type TrackedMetric } from "@/lib/metrics";
import { APP_NAME } from "@/lib/constants";
import { formatDate } from "@/lib/format";

type ScanWithMetrics = { metricScores: { metricType: string; score: number }[]; capturedAt: Date } | null | undefined;

function scoreFor(scan: ScanWithMetrics, type: TrackedMetric | "overall") {
  return scan?.metricScores.find((m) => m.metricType === type)?.score ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const share = await getShareBySlug(getDb(), slug);
  const overall = scoreFor(share?.scan, "overall");

  return {
    title: overall !== null ? `${overall}/100 skin score` : "Progress card",
    description: `A ${APP_NAME} progress card — sun damage, firmness, eye area, and moisture tracked over time.`,
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = getDb();
  const share = await getShareBySlug(db, slug);

  if (!share || !share.isPublic) notFound();

  await incrementShareViewCount(db, slug);

  const overall = scoreFor(share.scan, "overall") ?? 0;

  // A progress card spans two check-ins. Order them chronologically so the
  // card always reads earlier → later regardless of which scan the sharer
  // happened to have open when they created it.
  const comparison =
    share.kind === "progress_comparison" && share.compareScan
      ? share.compareScan.capturedAt <= share.scan.capturedAt
        ? { earlier: share.compareScan, later: share.scan }
        : { earlier: share.scan, later: share.compareScan }
      : null;

  if (comparison) {
    const earlierOverall = scoreFor(comparison.earlier, "overall");
    const laterOverall = scoreFor(comparison.later, "overall");
    const daysApart = Math.max(
      0,
      Math.round(
        (comparison.later.capturedAt.getTime() - comparison.earlier.capturedAt.getTime()) /
          86_400_000,
      ),
    );

    return (
      <div className="flex min-h-svh flex-col items-center bg-background px-safe py-12 pt-safe pb-safe [--gutter:1rem] md:py-16">
        <div className="flex w-full max-w-lg flex-col items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-mono text-lg font-bold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
              G
            </span>
            {APP_NAME}
          </Link>

          <Card className="w-full border-border/60">
            <CardContent className="flex flex-col items-center gap-6 py-8">
              <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
                {daysApart > 0 ? `${daysApart} days of progress` : "Progress"}
              </p>
              <div className="flex w-full items-center justify-center gap-2 sm:gap-4">
                <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:flex-none">
                  <ScoreRing score={earlierOverall ?? 0} className="size-28 sm:size-30" />
                  <span className="text-xs text-muted-foreground">
                    {formatDate(comparison.earlier.capturedAt)}
                  </span>
                </div>
                <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:flex-none">
                  <ScoreRing score={laterOverall ?? 0} className="size-28 sm:size-30" />
                  <span className="text-xs text-muted-foreground">
                    {formatDate(comparison.later.capturedAt)}
                  </span>
                </div>
              </div>

              <div className="grid w-full grid-cols-2 gap-4 border-t border-border/60 pt-6">
                {TRACKED_METRICS.map((metric) => {
                  const before = scoreFor(comparison.earlier, metric);
                  const after = scoreFor(comparison.later, metric);
                  const delta = before !== null && after !== null ? after - before : null;
                  return (
                    <div key={metric} className="flex flex-col items-center gap-1">
                      <span className="flex items-baseline gap-1.5 font-mono text-2xl font-bold tabular-nums">
                        {after ?? "—"}
                        {delta !== null && (
                          <span
                            className={
                              delta > 0
                                ? "text-sm text-emerald-500"
                                : delta < 0
                                  ? "text-sm text-destructive"
                                  : "text-sm text-muted-foreground"
                            }
                          >
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {METRIC_META[metric].label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="w-full border-primary/40 bg-primary/5">
            <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm">
                Track your own skin like this — sun damage, firmness, eye area, and moisture,
                measured over time.
              </p>
              <Button
                render={
                  <Link href="/sign-up">
                    Start free <ArrowRight className="size-4" />
                  </Link>
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center bg-background px-safe py-12 pt-safe pb-safe [--gutter:1rem] md:py-16">
      <div className="flex w-full max-w-lg flex-col items-center gap-8">
        <Link href="/" className="flex items-center gap-2 font-mono text-lg font-bold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
            G
          </span>
          {APP_NAME}
        </Link>

        <Card className="w-full border-border/60">
          <CardContent className="flex flex-col items-center gap-6 py-8">
            <ScoreRing score={overall} label="Overall score" className="size-40 sm:size-45" />
            <p className="text-sm text-muted-foreground">
              Check-in from {formatDate(share.scan.capturedAt)}
            </p>
            <div className="grid w-full grid-cols-2 gap-4 border-t border-border/60 pt-6">
              {TRACKED_METRICS.map((metric) => (
                <div key={metric} className="flex flex-col items-center gap-1">
                  <span className="font-mono text-2xl font-bold tabular-nums">
                    {scoreFor(share.scan, metric) ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {METRIC_META[metric].label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="w-full border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm">
              Track your own skin like this — sun damage, firmness, eye area, and
              moisture, measured over time.
            </p>
            <Button
              render={
                <Link href="/sign-up">
                  Start free <ArrowRight className="size-4" />
                </Link>
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
