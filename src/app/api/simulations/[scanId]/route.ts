import { auth } from "@clerk/nextjs/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { getSimulationForScan } from "@/db/queries/skin-simulations";

/**
 * Streams a scan's goal-simulation image out of R2. Same ownership pattern as
 * `/api/photos/[scanId]/[angle]` and `/api/masks/...` — the DB row proves
 * ownership, the URL is never trusted for it.
 *
 * Deliberately not exposed on the public share route (`/s/[slug]`): a
 * synthesized face of someone else's is a different privacy question from a
 * score card, and it isn't one this endpoint should answer by accident.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ scanId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { scanId } = await params;
  const db = getDb();

  const simulation = await getSimulationForScan(db, userId, scanId);
  if (!simulation?.r2Key) return new Response("Not found", { status: 404 });

  const { env } = getCloudflareContext();
  const object = await env.PHOTOS_BUCKET.get(simulation.r2Key);
  if (!object) return new Response("Not found", { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
