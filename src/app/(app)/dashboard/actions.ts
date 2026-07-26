"use server";

import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { createShare } from "@/db/queries/shares";
import { getScanById } from "@/db/queries/scans";
import { APP_URL } from "@/lib/constants";
import { captureServerEvent } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

/**
 * Creates a public card for a scan. Passing `compareScanId` makes it a
 * before/after card spanning two check-ins instead of a single result —
 * the progress story, which is the more shareable one.
 */
export async function createShareForScan(
  scanId: string,
  compareScanId?: string,
): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const db = getDb();

  // Both ids are scoped to the caller before they're written — the share
  // row is publicly readable, so a foreign scan id here would leak another
  // user's scores to anyone with the slug.
  const scan = await getScanById(db, userId, scanId);
  if (!scan) throw new Error("Scan not found");

  if (compareScanId) {
    const compareScan = await getScanById(db, userId, compareScanId);
    if (!compareScan) throw new Error("Scan not found");
  }

  const share = await createShare(db, userId, {
    kind: compareScanId ? "progress_comparison" : "single_scan",
    scanId,
    compareScanId,
  });

  captureServerEvent({
    distinctId: userId,
    event: ANALYTICS_EVENTS.SHARE_CARD_CREATED,
    properties: { scanId, compareScanId, kind: share.kind },
  });

  return `${APP_URL}/s/${share.slug}`;
}
