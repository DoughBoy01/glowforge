import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { skinConcernScores } from "@/db/schema";
import type { YouCamConcern } from "@/lib/youcam/types";

/**
 * Streams a concern's heatmap mask out of R2. Same ownership-check pattern
 * as `/api/photos/[scanId]/[angle]` — ownership is re-checked via the DB
 * row, not trusted from the URL.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ scanId: string; concern: string }> },
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { scanId, concern } = await params;
  const db = getDb();

  const row = await db.query.skinConcernScores.findFirst({
    where: and(
      eq(skinConcernScores.scanId, scanId),
      eq(skinConcernScores.concern, concern as YouCamConcern),
      eq(skinConcernScores.userId, userId),
    ),
  });
  if (!row?.maskUrl) return new Response("Not found", { status: 404 });

  const { env } = getCloudflareContext();
  const object = await env.PHOTOS_BUCKET.get(row.maskUrl);
  if (!object) return new Response("Not found", { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "image/png",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
