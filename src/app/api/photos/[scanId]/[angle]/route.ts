import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { scanPhotos } from "@/db/schema";

/**
 * Streams a scan photo out of R2. Bucket objects aren't public, and the
 * upload path (`check-in/actions.ts`) keys them by userId/scanId, so this
 * re-checks ownership via the DB row rather than trusting the URL alone —
 * the r2Key itself isn't a capability token.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ scanId: string; angle: string }> },
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { scanId, angle } = await params;
  const db = getDb();

  const photo = await db.query.scanPhotos.findFirst({
    where: and(
      eq(scanPhotos.scanId, scanId),
      eq(scanPhotos.angle, angle as "front" | "left" | "right" | "eyes_close"),
      eq(scanPhotos.userId, userId),
    ),
  });
  if (!photo) return new Response("Not found", { status: 404 });

  const { env } = getCloudflareContext();
  const object = await env.PHOTOS_BUCKET.get(photo.r2Key);
  if (!object) return new Response("Not found", { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
