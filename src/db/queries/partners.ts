import { and, eq, asc } from "drizzle-orm";
import type { Database } from "@/db";
import { partnerLinks } from "@/db/schema";

export async function getActivePartnerLinks(db: Database, kind?: "affiliate" | "sponsor") {
  return db.query.partnerLinks.findMany({
    where: kind
      ? and(eq(partnerLinks.isActive, true), eq(partnerLinks.kind, kind))
      : eq(partnerLinks.isActive, true),
    orderBy: [asc(partnerLinks.sortOrder)],
  });
}

export type PartnerLink = Awaited<ReturnType<typeof getActivePartnerLinks>>[number];

/**
 * The hand-picked set for the promotions panel — `isFeatured`, not just
 * `isActive`. Every partner link is eligible for the quiet teaser at the
 * foot of the dashboard; this is the much smaller set worth the prominent,
 * image-led placement right under the mission.
 */
export async function getFeaturedPartnerLinks(db: Database) {
  return db.query.partnerLinks.findMany({
    where: and(eq(partnerLinks.isActive, true), eq(partnerLinks.isFeatured, true)),
    orderBy: [asc(partnerLinks.sortOrder)],
  });
}

/**
 * The partner placement for one concern, if a partner has bought that slot.
 *
 * Picked from an already-fetched list rather than its own query — every
 * screen that shows the single recommendation is already loading the active
 * links for the general placements, and this is a five-row table. Rows with
 * no `metric` are general placements and are never eligible here: a partner
 * pick has to answer the concern it's shown against or it's just an ad
 * wearing the recommendation's clothes.
 */
export function partnerLinkForMetric(links: PartnerLink[], metric: string) {
  return links.find((link) => link.metric === metric) ?? null;
}
