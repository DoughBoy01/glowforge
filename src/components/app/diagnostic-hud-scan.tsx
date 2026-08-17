import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScoreLevelBadge } from "@/components/app/score-level-badge";
import type { ConcernScore } from "@/components/app/technical-breakdown";
import { CONCERN_META } from "@/lib/concerns";
import { cn } from "@/lib/utils";

/**
 * The full-photo composite reveal: every detected concern's heatmap mask,
 * locking on in sequence over the scan photo, plus a synced "target log"
 * list. All from data the analysis call already returned — no extra YouCam
 * request. A server component, like `FaceAgeHero`: the arrival motion is
 * CSS keyframes, so there's no client bundle to ship for it.
 */
export function DiagnosticHudScan({
  scanId,
  concerns,
  className,
}: {
  scanId: string;
  /** Caller passes `hasMask`-filtered, worst-first-sorted, capped to <=10 (the `.stagger` limit). */
  concerns: ConcernScore[];
  className?: string;
}) {
  const photoSrc = `/api/photos/${scanId}/front`;

  return (
    <Card className={cn("border-border/60", className)}>
      <CardHeader>
        <CardTitle>Full diagnostic scan</CardTitle>
        <CardDescription>
          Every signal the photo returned, locking on one at a time — the same read behind your
          four tracked scores, in full.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)] md:items-start">
        <div className="hud-notch hud-brackets relative aspect-[3/4] w-full overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoSrc} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />

          {/* One-shot light sweep on arrival — the panel powering up, ahead
              of the lock-ons. Decorative, so it stays out of the a11y tree. */}
          <span
            aria-hidden
            className="animate-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-accent/10 to-transparent"
          />

          <div className="stagger absolute inset-0">
            {concerns.map((c) => (
              <div key={c.concern} className="animate-lock-on absolute inset-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/masks/${scanId}/${c.concern}`}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        <ol className="stagger flex flex-col divide-y divide-border/60">
          {concerns.map((c, i) => {
            const meta = CONCERN_META[c.concern];
            return (
              <li key={c.concern} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[0.625rem] font-bold tabular-nums">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{meta.label}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {c.uiScore}
                </span>
                <ScoreLevelBadge score={c.uiScore} />
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
