"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/app/section-heading";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";

/** How long a featured row keeps its "New" badge, once. Presentation only — no schema flag for it, so a row ages out of "new" on its own rather than needing a second hand-managed toggle. */
const NEW_WINDOW_DAYS = 21;

export interface Promotion {
  slug: string;
  title: string;
  description: string | null;
  targetUrl: string;
  imageUrl: string | null;
  kind: string;
  createdAt: Date;
}

/**
 * The hand-picked, image-led placement for featuring new products on the
 * signed-in home — one step up from the quiet link list `PartnerTeaser`
 * renders at the foot of the page. Sits right under the prime move on
 * purpose: it's the highest-traffic real estate on the app, and only rows
 * someone has deliberately marked `isFeatured` earn it.
 *
 * A horizontal scroller rather than a grid — this panel is meant to hold
 * one to a handful of picks, and a scroller doesn't force the page to
 * reflow every time a row is added or removed by hand in the DB.
 */
export function PromotionsPanel({ promotions }: { promotions: Promotion[] }) {
  if (promotions.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>Featured</SectionHeading>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {promotions.map((promo) => (
          <PromotionCard key={promo.slug} promo={promo} />
        ))}
      </div>
    </section>
  );
}

function isNew(createdAt: Date) {
  return Date.now() - createdAt.getTime() < NEW_WINDOW_DAYS * 86_400_000;
}

function PromotionCard({ promo }: { promo: Promotion }) {
  return (
    <a
      href={promo.targetUrl}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() =>
        track(ANALYTICS_EVENTS.PROMOTION_CLICKED, { slug: promo.slug, kind: promo.kind })
      }
      className={cn(
        "hud-notch press group flex w-64 shrink-0 snap-start flex-col overflow-hidden",
        "border border-border/60 bg-card transition-colors hover:border-accent/50",
      )}
    >
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
        {promo.imageUrl ? (
          // Hand-managed, arbitrary-host partner URLs — not worth routing
          // through next/image for a table nobody's optimizing.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={promo.imageUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div aria-hidden className="hud-hazard size-full" />
        )}
        {isNew(promo.createdAt) && (
          <Badge className="absolute top-2 left-2 text-[10px]">New</Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium">{promo.title}</span>
          <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        </div>
        {promo.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{promo.description}</p>
        )}
      </div>
    </a>
  );
}
