import { eq, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { shares } from "@/db/schema";
import { generateReferralCode } from "@/lib/referral";

export async function createShare(
  db: Database,
  userId: string,
  input: {
    kind: "single_scan" | "progress_comparison";
    scanId: string;
    compareScanId?: string | null;
  },
) {
  const [share] = await db
    .insert(shares)
    .values({
      slug: generateReferralCode(8).toLowerCase(),
      userId,
      kind: input.kind,
      scanId: input.scanId,
      compareScanId: input.compareScanId ?? null,
    })
    .returning();
  return share;
}

export async function getShareBySlug(db: Database, slug: string) {
  return db.query.shares.findFirst({
    where: eq(shares.slug, slug),
    with: {
      user: true,
      scan: { with: { metricScores: true } },
      compareScan: { with: { metricScores: true } },
    },
  });
}

export async function incrementShareViewCount(db: Database, slug: string) {
  await db
    .update(shares)
    .set({ viewCount: sql`${shares.viewCount} + 1` })
    .where(eq(shares.slug, slug));
}

export async function getSharesForUser(db: Database, userId: string) {
  return db.query.shares.findMany({
    where: eq(shares.userId, userId),
  });
}
