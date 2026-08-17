import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FACE_AGE_LABEL, FACE_AGE_MISSION } from "@/lib/face-age";
import { APP_TAGLINE } from "@/lib/constants";

/**
 * The first thing a brand-new user ever sees — landed on directly after
 * sign-up, before a single scan exists. For a man new to this category, the
 * job here isn't the ask (one photo, already minimal) but the framing around
 * it: what this is instead of skincare, what it costs him (nothing — no
 * routine, no products), and the one line that defuses taking a selfie for a
 * beauty-adjacent purpose, which this audience won't say out loud but will
 * bounce off silently.
 *
 * Deliberately doesn't explain the baseline concept ("your first scan sets
 * the number everything after is measured against") — that's `BaselineReveal`'s
 * job, once there's a real number to hang it on. Explaining it here, before
 * they have anything to compare it to, is abstraction they don't need yet.
 */
export function FirstScanPriming() {
  return (
    <div className="hud-notch relative mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 overflow-hidden py-20 text-center ring-1 ring-border/60 md:min-h-0 md:py-24">
      <HazardEdge />
      <video
        className="pointer-events-none absolute inset-0 -z-10 size-full object-cover opacity-20 motion-reduce:hidden"
        src="/facescan.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
      />
      <Kicker>{FACE_AGE_LABEL}</Kicker>
      <h1 className="text-3xl leading-[0.95] md:text-5xl">Find out your face age</h1>
      <p className="text-base font-medium text-foreground/90">{APP_TAGLINE}</p>
      <p className="max-w-sm text-sm text-balance text-muted-foreground">
        {FACE_AGE_MISSION} No routine, no products required — just a photo, under
        two minutes. Private: it&apos;s for your score only, never shared.
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

/** The panel's top edge. Matches `FaceAgeHero`'s treatment — this screen sits
 * in the same visual slot before a user has a number to show there. */
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
