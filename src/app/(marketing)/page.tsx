import Link from "next/link";
import { Sun, Activity, Eye, Droplet, ArrowRight, TrendingUp, Flame, Share2, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { METRIC_META } from "@/lib/metrics";

const METRIC_ICONS = {
  sun_damage: Sun,
  firmness: Activity,
  eye_area: Eye,
  moisture: Droplet,
} as const;

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background" />
        <div className="mx-auto flex max-w-4xl flex-col items-center px-safe py-20 text-center [--gutter:1rem] md:py-32">
          <span className="mb-6 rounded-full border border-border bg-card px-4 py-1 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Skin performance tracking for men 35+
          </span>
          <h1 className="animate-glitch-in text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-6xl">
            {APP_TAGLINE}
          </h1>
          <p className="mt-6 max-w-2xl text-base text-balance text-muted-foreground sm:text-lg">
            {APP_NAME} measures sun damage, firmness, eye area, and moisture over time —
            so you know if what you&apos;re doing is actually working. No guesswork,
            no vague &quot;glow.&quot; Just data.
          </p>
          {/* Full-width stacked buttons on a phone: the thumb-friendly
              default, and it keeps the primary action unambiguous. */}
          <div className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button
              size="lg"
              className="w-full sm:w-auto"
              render={
                <Link href="/sign-up">
                  Start your baseline scan <ArrowRight className="size-4" />
                </Link>
              }
            />
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
              render={<Link href="/pricing">See pricing</Link>}
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border/60 bg-card/30 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-safe [--gutter:1rem]">
          <div className="mb-12 max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Four metrics. Zero fluff.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Every check-in scores the dimensions that actually change with age and
              sun exposure — tracked the same way you&apos;d track lifts or mile times.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(METRIC_META).map(([key, meta]) => {
              const Icon = METRIC_ICONS[key as keyof typeof METRIC_ICONS];
              return (
                <Card key={key} className="border-border/60">
                  <CardHeader>
                    <Icon className="size-6 text-primary" strokeWidth={1.75} />
                    <CardTitle className="mt-2">{meta.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{meta.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-safe [--gutter:1rem]">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-3">
              <TrendingUp className="size-7 text-accent" strokeWidth={1.75} />
              <h3 className="text-lg font-semibold">Trend, don&apos;t guess</h3>
              <p className="text-sm text-muted-foreground">
                Every check-in plots against your history. See what&apos;s actually
                improving and what&apos;s stalled — same as a training log.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <ScanFace className="size-7 text-accent" strokeWidth={1.75} />
              <h3 className="text-lg font-semibold">See exactly what it saw</h3>
              <p className="text-sm text-muted-foreground">
                Every scan gives you the full concern-by-concern read — wrinkles, pores,
                redness, and more — not just four headline numbers.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Flame className="size-7 text-accent" strokeWidth={1.75} />
              <h3 className="text-lg font-semibold">Routines that stick</h3>
              <p className="text-sm text-muted-foreground">
                Log your AM/PM routine, build a streak, and see which habits correlate
                with your score moving.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Share2 className="size-7 text-accent" strokeWidth={1.75} />
              <h3 className="text-lg font-semibold">Progress you can show</h3>
              <p className="text-sm text-muted-foreground">
                Generate a shareable progress card from any two check-ins — proof, not
                a before/after filter.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border/60 bg-card/30 py-16 md:py-20">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-safe text-center [--gutter:1rem]">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Your skin has data. Start reading it.
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Free to start. No credit card. First scan takes under two minutes.
          </p>
          <Button
            size="lg"
            className="mt-8 w-full sm:w-auto"
            render={
              <Link href="/sign-up">
                Start your baseline scan <ArrowRight className="size-4" />
              </Link>
            }
          />
        </div>
      </section>
    </>
  );
}
