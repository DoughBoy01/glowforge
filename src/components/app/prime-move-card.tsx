"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, Store } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductLink } from "@/components/app/product-link";
import { LevelIndicator } from "@/components/app/score-level-badge";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics/client";
import type { PrimeMove } from "@/lib/prime-move";
import { cn } from "@/lib/utils";

interface PartnerPick {
  slug: string;
  title: string;
  description: string | null;
  targetUrl: string;
}

/**
 * The one thing to do, from the latest scan.
 *
 * The full routine is five steps and eight product links, and for a man who
 * has never owned a serum that reads as a wall rather than a plan. This card
 * is the other door: one product class, one spec he can shop from memory, one
 * instruction, and no decision to make. It sits *above* the routine on every
 * screen that shows both — the routine then reads as the optional step up
 * rather than the price of entry.
 *
 * Consulting, not selling, is a structural rule here and not just a tone:
 * the spec comes first and names no brand, the high street is named before
 * any link, and the curated picks are collapsed behind a disclosure nobody
 * has to open. Someone can act on this card entirely without us earning a
 * penny, which is the point — that's what makes the advice worth trusting.
 */
export function PrimeMoveCard({
  move,
  partner,
  href = "/routine",
  onSeeFullRoutine,
  className,
}: {
  move: PrimeMove;
  partner?: PartnerPick | null;
  /** Where "see the full routine" goes — the routine page, or an anchor on results. Ignored when `onSeeFullRoutine` is set. */
  href?: string;
  /** For callers rendering both views in place (the routine page's tabs) — switches tabs instead of navigating. Takes priority over `href`. */
  onSeeFullRoutine?: () => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const hasOptions = move.options.length > 0 || partner != null;

  function toggle() {
    const next = !open;
    setOpen(next);
    // Only the opening is worth an event. This is the question the card is
    // really asking — how many men want the shortlist versus how many are
    // happy to walk into Boots with a spec — and it can't be read off the
    // click-through rate, since not opening is a success too.
    if (next) track(ANALYTICS_EVENTS.PRIME_MOVE_OPTIONS_OPENED, { metric: move.metric });
  }

  return (
    <Card className={cn("hud-notch border-accent/40 bg-card", className)}>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Not `text-accent`, despite matching the codename below it.
                Light-mode accent lands at 3.8:1 — comfortably over the 3:1
                large-text bar the 36px codename has to clear, and under the
                4.5:1 this 10px label does. */}
            <span className="font-mono text-[0.625rem] font-bold tracking-[0.16em] uppercase">
              If you only do one thing
            </span>
            {/* The category that chose this move, colored by how it scored —
                so the card says which reading sent them here, not just what
                to buy. */}
            <LevelIndicator level={move.level} label={move.metricLabel} />
          </div>

          {/* The codename is the one thing this card exists to deliver, so it
              gets the display face and everything under it stays mono or body
              — same rule the face age hero follows. */}
          <p className="text-sm text-muted-foreground">{move.readyPrefix}</p>
          <p className="display neon-accent text-3xl leading-none text-accent sm:text-4xl">
            {move.codename}
          </p>
          <p className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
            {move.productClass}
          </p>
        </div>

        {/* The spec and where to get it, boxed together — this pair is the
            entire actionable payload, and it has to survive being the only
            thing someone reads. */}
        <div className="flex flex-col gap-2 border-l-2 border-accent/50 pl-3">
          <p className="text-sm font-medium text-balance">{move.spec}</p>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Store aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.1} />
            <span>{move.where}</span>
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
            How to use it
          </span>
          <p className="text-sm">{move.how}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
            Why this one
          </span>
          <p className="text-sm text-muted-foreground">{move.because}</p>
        </div>

        {hasOptions && (
          <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="press-sm flex min-h-11 items-center justify-between gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="text-sm text-muted-foreground">
                We&apos;ve curated a few options if you&apos;d like.
              </span>
              <ChevronDown
                aria-hidden
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </button>

            {open && (
              <div className="flex flex-col gap-3">
                {partner && (
                  <a
                    href={partner.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    onClick={() =>
                      track(ANALYTICS_EVENTS.PARTNER_LINK_CLICKED, {
                        slug: partner.slug,
                        kind: "prime_move",
                      })
                    }
                    className="press flex items-center justify-between gap-3 rounded-md border border-accent/40 bg-accent/5 px-3 py-2.5 text-sm transition-colors hover:bg-accent/10"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{partner.title}</span>
                        {/* Labelled, not disguised. A paid slot that reads as
                            an editorial pick is exactly the trade this card is
                            built to avoid. */}
                        <Badge variant="outline" className="border-accent/50 text-[10px]">
                          Partner pick
                        </Badge>
                      </span>
                      {partner.description && (
                        <span className="text-xs text-muted-foreground">{partner.description}</span>
                      )}
                    </span>
                    <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                  </a>
                )}

                {move.options.map((product) => (
                  <ProductLink key={product.id} product={product} metric={move.metric} />
                ))}

                {move.options.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    These are affiliate links — we may earn a commission at no cost to you. Anything
                    matching the spec above works just as well, and we&apos;d rather you bought it
                    down the road than not at all.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
          <p className="text-sm text-muted-foreground">
            One product, done every day, beats five done for a week. Start here — the full routine
            is waiting when you want it.
          </p>
          {onSeeFullRoutine ? (
            <button
              type="button"
              onClick={onSeeFullRoutine}
              className="press-sm self-start rounded-md font-mono text-[0.625rem] font-bold tracking-[0.16em] uppercase underline decoration-dotted underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              See the full routine
            </button>
          ) : (
            <Link
              href={href}
              className="press-sm self-start rounded-md font-mono text-[0.625rem] font-bold tracking-[0.16em] uppercase underline decoration-dotted underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              See the full routine
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
