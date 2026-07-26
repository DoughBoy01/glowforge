import posthog from "posthog-js";
import type { AnalyticsEvent } from "./events";

/** Client-side capture. Safe to call before init (posthog-js queues internally). */
export function track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}

export { ANALYTICS_EVENTS } from "./events";
