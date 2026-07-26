"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { usePostHog } from "posthog-js/react";

/** Mount once inside the authenticated app shell to link the anonymous
 * pre-signup session to the real user. */
export function PostHogIdentify() {
  const { user, isSignedIn } = useUser();
  const posthog = usePostHog();

  useEffect(() => {
    if (!isSignedIn || !user || !posthog) return;
    posthog.identify(user.id, {
      email: user.primaryEmailAddress?.emailAddress,
      name: user.fullName,
    });
  }, [isSignedIn, user, posthog]);

  return null;
}
