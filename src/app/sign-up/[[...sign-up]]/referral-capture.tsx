"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/** Stashes ?ref=CODE in a short-lived cookie so the (app) layout can attach
 * it to the new user's row on first authenticated load — Clerk webhooks
 * don't carry the visitor's cookies, so this can't happen server-side here. */
export function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;
    document.cookie = `gf_ref=${encodeURIComponent(ref)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  }, [searchParams]);

  return null;
}
