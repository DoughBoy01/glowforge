"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { createScan } from "@/db/queries/scans";
import { TRACKED_METRICS, type TrackedMetric } from "@/lib/metrics";
import { captureServerEvent } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { requestSkinAnalysis } from "@/lib/skin-analysis";

const PHOTO_ANGLES = ["front", "left", "right", "eyes_close"] as const;

function clampScore(value: FormDataEntryValue): number {
  const n = Number(value);
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 50)));
}

export async function submitCheckIn(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Manual scoring is an opt-in toggle in the form — absent fields mean the
  // user left it off and is relying on the AI analysis entirely, so we only
  // write rows for metrics actually present rather than inventing defaults.
  const scores = Object.fromEntries(
    TRACKED_METRICS.filter((metric) => formData.has(metric)).map((metric) => [
      metric,
      clampScore(formData.get(metric)!),
    ]),
  ) as Partial<Record<TrackedMetric, number>>;

  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const scanId = crypto.randomUUID();

  const photos: { angle: (typeof PHOTO_ANGLES)[number]; r2Key: string }[] = [];
  const { env } = getCloudflareContext();

  for (const angle of PHOTO_ANGLES) {
    const file = formData.get(`photo_${angle}`);
    if (file instanceof File && file.size > 0) {
      const ext = file.type.split("/")[1] || "jpg";
      const r2Key = `scans/${userId}/${scanId}/${angle}.${ext}`;
      await env.PHOTOS_BUCKET.put(r2Key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });
      photos.push({ angle, r2Key });
    }
  }

  const db = getDb();
  const { overall } = await createScan(db, {
    id: scanId,
    userId,
    notes,
    scores,
    photos,
  });

  captureServerEvent({
    distinctId: userId,
    event: ANALYTICS_EVENTS.CHECK_IN_COMPLETED,
    properties: { overall, hasPhotos: photos.length > 0 },
  });

  // The front photo is required by the form, so this always fires — it's
  // the primary path now, not a fallback. Runs in the background via
  // waitUntil; the results page polls for completion and reveals the
  // AI-derived scores once they land.
  const frontPhoto = photos.find((p) => p.angle === "front");
  if (frontPhoto) {
    requestSkinAnalysis({ userId, scanId, r2Key: frontPhoto.r2Key });
  }

  redirect(`/scans/${scanId}`);
}
