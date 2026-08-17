import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ArrowRight, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScoreRing } from "@/components/app/score-ring";
import { DeltaBadge } from "@/components/app/delta-badge";
import { ScoreLevelBadge } from "@/components/app/score-level-badge";
import { ScanComparePicker } from "@/components/app/scan-compare-picker";
import { ShareButton } from "@/components/app/share-button";
import { getDb } from "@/db";
import {
  getScanHistory,
  getScanById,
  getConcernScoresForScans,
  getFaceAgeReadings,
} from "@/db/queries/scans";
import { compareScans, compareConcerns } from "@/lib/progress";
import { FACE_AGE_LABEL, buildFaceAgeMission } from "@/lib/face-age";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Compare check-ins" };

/** How far back the picker reaches. Matches the progress page's window. */
const PICKER_LIMIT = 60;

export default async function CompareScansPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { userId } = await auth();
  const db = getDb();

  const [{ from: fromParam, to: toParam }, history, faceAgeReadings] = await Promise.all([
    searchParams,
    getScanHistory(db, userId!, { limit: PICKER_LIMIT }),
    getFaceAgeReadings(db, userId!),
  ]);

  if (history.length < 2) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Not enough history yet</h1>
        <p className="text-sm text-muted-foreground">
          Comparing needs two check-ins. Log another one and you&apos;ll be able to put any two
          side by side.
        </p>
        <Button
          render={
            <Link href="/check-in">
              New check-in <ArrowRight className="size-4" />
            </Link>
          }
        />
      </div>
    );
  }

  // Default to baseline → latest: the widest view of progress the loaded
  // window can show. Unknown or foreign ids fall back rather than 404 —
  // a stale bookmark should still land on something useful.
  const defaultFrom = history.at(-1)!.id;
  const defaultTo = history[0].id;

  const [fromScan, toScan] = await Promise.all([
    fromParam ? getScanById(db, userId!, fromParam) : null,
    toParam ? getScanById(db, userId!, toParam) : null,
  ]);

  const from = fromScan ?? (await getScanById(db, userId!, defaultFrom))!;
  const to = toScan ?? (await getScanById(db, userId!, defaultTo))!;

  if (from.id === to.id) {
    redirect(`/scans/compare?from=${defaultFrom}&to=${defaultTo}`);
  }

  // Order the pair chronologically regardless of how they were picked, so
  // "delta" always reads as later-minus-earlier.
  const [earlier, later] =
    from.capturedAt <= to.capturedAt ? [from, to] : [to, from];

  // As-of-`later` mission state, same rule as the results page: Share only
  // once the mission was "ahead" by the date of the later scan in view.
  const missionAsOfLater = buildFaceAgeMission(
    faceAgeReadings.filter((r) => r.capturedAt <= later.capturedAt),
  );

  const concernRows = await getConcernScoresForScans(db, userId!, [earlier.id, later.id]);

  const metricDeltas = compareScans(earlier, later);
  const concernDeltas = compareConcerns(concernRows, earlier.id, later.id);

  const daysApart = Math.max(
    0,
    Math.round((later.capturedAt.getTime() - earlier.capturedAt.getTime()) / 86_400_000),
  );

  const earlierAge =
    earlier.analysis?.status === "succeeded" ? (earlier.analysis.skinAge ?? null) : null;
  const laterAge =
    later.analysis?.status === "succeeded" ? (later.analysis.skinAge ?? null) : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {/* The app bar already reads "Compare" on mobile. */}
          <h1 className="sr-only text-2xl font-bold tracking-tight md:not-sr-only">
            Compare check-ins
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(earlier.capturedAt)} → {formatDate(later.capturedAt)}
            {daysApart > 0 && ` · ${daysApart} day${daysApart === 1 ? "" : "s"} apart`}
          </p>
        </div>
        <Button
          variant="outline"
          className="max-md:hidden"
          render={<Link href="/scans">Back to progress</Link>}
        />
      </div>

      <ScanComparePicker
        scans={history.map((s) => ({ id: s.id, label: formatDate(s.capturedAt) }))}
        fromId={earlier.id}
        toId={later.id}
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <ScanSide scan={earlier} caption="Baseline" />
        <ScanSide scan={later} caption="Compared to" />
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>What changed</CardTitle>
          <CardDescription>
            Each tracked category, {formatDate(earlier.capturedAt)} versus{" "}
            {formatDate(later.capturedAt)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border/60">
          {metricDeltas.map((row) => (
            <div key={row.metric} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-sm font-medium">{row.label}</span>
              <div className="flex items-baseline gap-3 font-mono text-sm tabular-nums">
                <span className="text-muted-foreground">{row.from ?? "—"}</span>
                <ArrowRight className="size-3 self-center text-muted-foreground" />
                <span className="font-bold">{row.to ?? "—"}</span>
                <DeltaBadge delta={row.delta} className="w-12 justify-end" />
              </div>
            </div>
          ))}
          {earlierAge !== null && laterAge !== null && (
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-sm font-medium">{FACE_AGE_LABEL}</span>
              <div className="flex items-baseline gap-3 font-mono text-sm tabular-nums">
                <span className="text-muted-foreground">{earlierAge}</span>
                <ArrowRight className="size-3 self-center text-muted-foreground" />
                <span className="font-bold">{laterAge}</span>
                {/* Lower is better here — a drop is the good direction. */}
                <DeltaBadge
                  delta={laterAge - earlierAge}
                  lowerIsBetter
                  className="w-12 justify-end"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {concernDeltas.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Concern by concern</CardTitle>
            <CardDescription>
              The raw signals behind those categories, worst first on the later scan.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {concernDeltas.map((row) => (
              <div key={row.concern} className="flex items-center justify-between gap-4 py-1">
                <span className="truncate text-sm">{row.label}</span>
                <div className="flex items-baseline gap-3 font-mono text-sm tabular-nums">
                  <span className="text-muted-foreground">{row.from ?? "—"}</span>
                  <span className="font-bold">{row.to ?? "—"}</span>
                  <DeltaBadge delta={row.delta} className="w-12 justify-end" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {missionAsOfLater.state === "ahead" && (
          <ShareButton
            scanId={later.id}
            compareScanId={earlier.id}
            label="Share progress"
            className="w-full sm:w-auto"
          />
        )}
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          render={<Link href={`/scans/${later.id}`}>Full results</Link>}
        />
      </div>
    </div>
  );
}

function ScanSide({
  scan,
  caption,
}: {
  scan: {
    id: string;
    capturedAt: Date;
    metricScores: { metricType: string; score: number }[];
    photos: { angle: string }[];
  };
  caption: string;
}) {
  const overall = scan.metricScores.find((m) => m.metricType === "overall")?.score ?? 0;
  const hasFrontPhoto = scan.photos.some((p) => p.angle === "front");

  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-col items-center gap-3 py-5 md:gap-4 md:py-6">
        <span className="text-center font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase md:text-xs">
          {caption}
        </span>
        {hasFrontPhoto ? (
          <Image
            src={`/api/photos/${scan.id}/front`}
            alt=""
            width={160}
            height={200}
            className="aspect-[4/5] h-auto w-full rounded-lg object-cover ring-1 ring-border/60 md:h-48 md:w-40"
          />
        ) : (
          <div className="flex aspect-[4/5] w-full items-center justify-center rounded-lg bg-muted md:h-48 md:w-40">
            <ImageOff className="size-6 text-muted-foreground" />
          </div>
        )}
        <ScoreRing
          score={overall}
          label={formatDate(scan.capturedAt)}
          className="size-24 md:size-28"
        />
        <ScoreLevelBadge score={overall} />
      </CardContent>
    </Card>
  );
}
