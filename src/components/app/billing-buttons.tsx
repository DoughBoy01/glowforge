"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics/client";

async function goToStripe(endpoint: string) {
  const res = await fetch(endpoint, { method: "POST" });
  if (!res.ok) {
    toast.error("Something went wrong. Try again in a moment.");
    return;
  }
  const { url } = (await res.json()) as { url: string };
  window.location.href = url;
}

export function UpgradeButton() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      size="lg"
      className="w-full sm:w-auto"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        track(ANALYTICS_EVENTS.CHECKOUT_STARTED);
        await goToStripe("/api/stripe/checkout");
        setLoading(false);
      }}
    >
      {loading ? "Redirecting…" : "Upgrade to Pro"}
    </Button>
  );
}

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="outline"
      size="lg"
      className="w-full sm:w-auto"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        track(ANALYTICS_EVENTS.BILLING_PORTAL_OPENED);
        await goToStripe("/api/stripe/portal");
        setLoading(false);
      }}
    >
      {loading ? "Redirecting…" : "Manage billing"}
    </Button>
  );
}
