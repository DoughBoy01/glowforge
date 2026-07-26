import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeftRight, ChevronRight, ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DeltaBadge } from "@/components/app/delta-badge";
import { SwipeRow, SwipeAction } from "@/components/app/swipe-row";
import { TRACKED_METRICS, METRIC_META, scoreForMetric } from "@/lib/metrics";
import { formatDate } from "@/lib/format";

export interface TimelineScan {
  id: string;
  capturedAt: Date;
  notes?: string | null;
  metricScores: { metricType: string; score: number }[];
  photos: { angle: string }[];
  analysis?: { status: string; skinAge: number | null } | null;
}

const STATUS_COPY: Record<string, string> = {
  pending: "Analyzing",
  processing: "Analyzing",
  failed: "Analysis failed",
};

/**
 * Every check-in ever logged, newest first. Each row carries its own
 * scan-over-scan delta, so the archive reads as a progression rather than
 * a pile of undifferentiated results.
 *
 * `scans` must be newest-first — the delta for a row is computed against
 * the row after it.
 *
 * On touch, each row also hides a compare action under a leftward swipe: the
 * newest row compares against the one before it, every other row against the
 * newest, so "swipe left" always means "how does this stack up?".
 */
export function ScanTimeline({ scans }: { scans: TimelineScan[] }) {
  const latest = scans[0];
  const secondNewest = scans[1];

  return (
    <div className="flex flex-col gap-3">
      {scans.map((scan, i) => {
        const previous = scans[i + 1] ?? null;
        // The pair to compare with, oldest first — `from` is always the
        // earlier of the two so the comparison reads forwards in time.
        const comparison =
          i === 0
            ? secondNewest && { from: secondNewest.id, to: scan.id }
            : latest && { from: scan.id, to: latest.id };
        const overall = scoreForMetric(scan.metricScores, "overall");
        const previousOverall = previous ? scoreForMetric(previous.metricScores, "overall") : null;
        const delta = overall !== null && previousOverall !== null ? overall - previousOverall : null;
        const hasFrontPhoto = scan.photos.some((p) => p.angle === "front");
        const status = scan.analysis?.status;
        const statusCopy = status ? STATUS_COPY[status] : undefined;

        const row = (
          <Card className="press border-border/60 transition-colors hover:bg-muted/40 active:bg-muted/60">
            <CardContent className="flex items-center gap-4 py-4">
              {/* The whole row is the target, not just the date — comfortably
                  past the 44px minimum thanks to the 56px thumbnail. */}
              <Link
                href={`/scans/${scan.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:gap-4"
              >
                {hasFrontPhoto ? (
                  <Image
                    src={`/api/photos/${scan.id}/front`}
                    alt=""
                    width={56}
                    height={56}
                    className="size-14 shrink-0 rounded-full object-cover ring-1 ring-border/60"
                  />
                ) : (
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted">
                    <ImageOff className="size-5 text-muted-foreground" />
                  </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-medium">{formatDate(scan.capturedAt)}</span>
                    {i === 0 && <Badge variant="secondary">Latest</Badge>}
                    {i === scans.length - 1 && scans.length > 1 && (
                      <Badge variant="outline">Baseline</Badge>
                    )}
                    {statusCopy && <Badge variant="outline">{statusCopy}</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground sm:gap-x-4">
                    {TRACKED_METRICS.map((metric) => {
                      const score = scoreForMetric(scan.metricScores, metric);
                      return (
                        <span key={metric} className="tabular-nums">
                          {METRIC_META[metric].short} {score ?? "—"}
                        </span>
                      );
                    })}
                    {scan.analysis?.skinAge != null && (
                      <span className="tabular-nums">Age {scan.analysis.skinAge}</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="font-mono text-2xl font-bold tabular-nums">
                    {overall ?? "—"}
                  </span>
                  <DeltaBadge delta={delta} emptyLabel={previous ? "" : "baseline"} />
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
        );

        if (!comparison) return <Fragment key={scan.id}>{row}</Fragment>;

        return (
          <SwipeRow
            key={scan.id}
            actionCount={1}
            actions={
              <SwipeAction
                href={`/scans/compare?from=${comparison.from}&to=${comparison.to}`}
                icon={<ArrowLeftRight className="size-4" />}
                label="Compare"
                tone="primary"
              />
            }
          >
            {row}
          </SwipeRow>
        );
      })}
    </div>
  );
}
