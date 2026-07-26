/**
 * Light haptic feedback for touch interactions.
 *
 * Android/Chrome honours `navigator.vibrate`; iOS Safari does not implement
 * it at all, so this is a progressive enhancement — it must never be the
 * only confirmation an interaction happened (every call site also has a
 * visual response).
 */

type Pattern = "select" | "impact" | "success";

const PATTERNS: Record<Pattern, number | number[]> = {
  /** Changing tabs, toggling a control. */
  select: 8,
  /** Committing something — submitting, confirming. */
  impact: 14,
  /** Completing a task (logging a routine, finishing a scan). */
  success: [10, 40, 16],
};

export function haptic(pattern: Pattern = "select") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  // Respect a user who has asked the OS to tone motion down.
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Some browsers throw on vibrate without a user gesture — never a
    // reason to break the interaction that triggered it.
  }
}
