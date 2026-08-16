import Link from "next/link";
import { ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  FACE_AGE_LABEL,
  getMissionLine,
  years,
  type FaceAgeMission,
} from "@/lib/face-age";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The mission, at the top of the home screen and bigger than anything else on
 * it.
 *
 * This used to be one grey line reading "Skin age 37" tucked under the overall
 * score ring, which had the hierarchy backwards: the four metric scores are
 * diagnostics — they say *which* thing is aging the face — and a 0-100 composite
 * of them is a number with no natural target. Face age has one. It's in years,
 * everyone already knows which direction is good, and it's the only readout here
 * that answers "is this working?" without needing a legend.
 *
 * The number is set in the display face rather than the mono one it used to
 * use. Mono is this app's readout voice — correct for the stats underneath it,
 * wrong for the one figure the whole screen exists to deliver, which should
 * read as a mission title and not as another row of telemetry.
 *
 * A server component on purpose. It's the first thing painted on a phone, it
 * has no state, and shipping a client bundle to render a number the server
 * already knows would only delay it — which is why the arrival motion here is
 * CSS keyframes rather than a count-up.
 */
export function FaceAgeHero({
  mission,
  className,
}: {
  mission: FaceAgeMission;
  className?: string;
}) {
  const { headline, body } = getMissionLine(mission);
  const { current, baseline, best, lastMove, state, atBest } = mission;

  // "Winning" is strictly below baseline. Level isn't a win — it's a month of
  // work with nothing banked, and colouring it like a win would be flattery.
  const ahead = state === "ahead";
  const Trend = state === "ahead" ? TrendingDown : state === "behind" ? TrendingUp : Minus;

  if (current === null) {
    return (
      <Card
        className={cn(
          "hud-notch relative -mx-4 rounded-none ring-0 [--card-spacing:--spacing(6)] md:mx-0 md:ring-1",
          className,
        )}
      >
        <HazardEdge />
        <CardContent className="flex flex-col gap-3">
          <Kicker>{FACE_AGE_LABEL}</Kicker>
          <p className="display text-4xl leading-[0.95] text-balance">{headline}</p>
          <p className="max-w-[60ch] text-sm text-balance text-muted-foreground">{body}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Link
      href="/scans"
      aria-label={`${FACE_AGE_LABEL} ${current}. ${headline}. View full history.`}
      className="block outline-none md:rounded-none md:focus-visible:ring-3 md:focus-visible:ring-ring/50"
    >
      {/* Full-bleed band on a phone: this is the top of the first screen, and
          insetting it by a gutter spends width the number wants. */}
      <Card
        className={cn(
          "press hud-notch relative -mx-4 h-full overflow-hidden rounded-none ring-0 [--card-spacing:--spacing(6)] md:mx-0 md:ring-1",
          ahead && "md:border-primary/40",
          className,
        )}
      >
        <HazardEdge />

        {/* One-shot scan sweep on arrival — the panel powering up. Purely
            decorative, so it never reaches the a11y tree, and it runs once
            rather than looping so the screen settles. */}
        <span
          aria-hidden
          className="animate-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-primary/[0.07] to-transparent"
        />

        {/* Two columns once there's width for them: the mission on the left,
            its supporting telemetry in a rail on the right. Stacked, the
            panel left a third of itself empty on a desktop — which is what
            made it read as a stretched phone screen rather than a HUD. */}
        <CardContent className="relative grid gap-x-8 gap-y-5 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <Kicker>{FACE_AGE_LABEL}</Kicker>
              {atBest && mission.readings > 1 && (
                <span className="-skew-x-6 bg-primary px-2 py-0.5 font-mono text-[0.625rem] font-bold tracking-[0.16em] text-primary-foreground uppercase md:hidden dark:shadow-[2px_2px_0] dark:shadow-accent/50">
                  <span className="inline-block skew-x-6">Your record</span>
                </span>
              )}
            </div>

            {/* The number and the verdict share a baseline, so the eye lands
                on the years and reads the direction without moving. */}
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <span
                className={cn(
                  "animate-glitch-in display block leading-[0.78] tabular-nums",
                  "text-[clamp(5.5rem,26vw,11rem)]",
                  ahead && "neon-lg text-primary",
                )}
              >
                {current}
              </span>

              <div className="flex min-w-0 flex-col gap-2 pb-2">
                <span
                  className={cn(
                    "flex items-center gap-2 text-balance",
                    ahead ? "text-primary" : "text-foreground",
                  )}
                >
                  <Trend
                    className={cn("size-6 shrink-0 md:size-8", ahead && "neon")}
                    strokeWidth={2.6}
                  />
                  <span className="display text-2xl leading-[0.95] md:text-4xl">{headline}</span>
                </span>
                {lastMove !== null && (
                  <span className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase tabular-nums">
                    {lastMove === 0
                      ? "No change last scan"
                      : `${lastMove < 0 ? "−" : "+"}${years(lastMove)} last scan`}
                  </span>
                )}
              </div>
            </div>

            <p className="max-w-[52ch] text-sm text-balance text-muted-foreground">{body}</p>
          </div>

          {/* Baseline and record, the two numbers that give the big one a
              scale, plus how long it took to move it. Hidden entirely on a
              single reading, where they'd just repeat the same number back. */}
          {baseline !== null && mission.readings > 1 && (
            <dl
              className={cn(
                "grid grid-cols-3 gap-4 border-t border-border/60 pt-4",
                // Spanning both rows parks the rail beside the mission *and*
                // the link below it, which is what lets the link fall after
                // the stats once this all stacks onto one column.
                "md:row-span-2 md:w-44 md:grid-cols-1 md:gap-0 md:border-t-0 md:border-l md:pt-0 md:pl-6",
              )}
            >
              {atBest && (
                <div className="col-span-3 hidden md:col-span-1 md:block md:pb-3">
                  <span className="inline-block -skew-x-6 bg-primary px-2 py-0.5 font-mono text-[0.625rem] font-bold tracking-[0.16em] text-primary-foreground uppercase dark:shadow-[2px_2px_0] dark:shadow-accent/50">
                    <span className="inline-block skew-x-6">Your record</span>
                  </span>
                </div>
              )}
              <Stat label="Baseline" value={baseline} footer="where you started" />
              {best && (
                <Stat
                  label="Record"
                  value={best.faceAge}
                  footer={formatShortDate(best.capturedAt)}
                  lit={atBest}
                />
              )}
              <Stat
                label="Tracked"
                value={mission.daysTracked}
                unit="d"
                footer={`${mission.readings} scans`}
              />
            </dl>
          )}

          <span className="flex items-center gap-1 justify-self-start font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
            Full history <ChevronRight className="size-3.5" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

/** The panel's top edge. Carries the angle motif without spending a colour. */
function HazardEdge() {
  return (
    <span aria-hidden className="hud-hazard pointer-events-none absolute inset-x-0 top-0 h-[3px]" />
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
      <span aria-hidden className="inline-block h-3 w-1 -skew-x-12 bg-accent" />
      {children}
    </p>
  );
}

/**
 * A readout tile — mono and tabular, because these are telemetry supporting
 * the display-face number above rather than competing with it.
 *
 * Sits in a three-across row on a phone and a stacked rail on a desktop, so
 * the dividers are declared per-axis: a bottom hairline only once the tiles
 * are stacked, and none on the last one.
 */
function Stat({
  label,
  value,
  unit,
  footer,
  lit = false,
}: {
  label: string;
  value: number;
  unit?: string;
  footer: string;
  lit?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 md:border-b md:border-border/60 md:py-3 md:first-of-type:pt-0 md:last-of-type:border-b-0 md:last-of-type:pb-0">
      <dt className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "font-mono text-2xl leading-none font-bold tabular-nums",
          lit && "neon text-primary",
        )}
      >
        {value}
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </dd>
      {/* Wraps rather than truncates: at three-across on a narrow phone
          "where you started" loses its last word to an ellipsis, and the
          footer is the line that says what the number above it means. */}
      <span className="text-xs text-balance text-muted-foreground md:truncate">{footer}</span>
    </div>
  );
}
