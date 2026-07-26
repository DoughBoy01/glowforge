import { PostHog } from "posthog-node";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AnalyticsEvent } from "./events";

/**
 * Server-side capture for events that happen off the client (webhook
 * handlers, cron, etc). Workers isolates are short-lived, so we flush every
 * event immediately rather than relying on posthog-node's background batch
 * timer, and hand the shutdown to `waitUntil` so it completes without
 * blocking the response.
 */
export function captureServerEvent(params: {
  distinctId: string;
  event: AnalyticsEvent;
  properties?: Record<string, unknown>;
}) {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;

  const client = new PostHog(apiKey, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });

  client.capture(params);

  try {
    getCloudflareContext().ctx.waitUntil(client.shutdown());
  } catch {
    // Outside request scope (e.g. local script) — best effort.
    void client.shutdown();
  }
}
