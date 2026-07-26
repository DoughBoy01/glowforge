"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { parentPath } from "@/lib/nav";

/**
 * Tracks whether this browsing session has navigated inside the app yet.
 *
 * Module scope, not state: it has to survive the remount of every component
 * that asks. `history.length` can't answer this — in a standalone PWA it is
 * routinely > 1 on a cold start, so trusting it would pop the user out of
 * the app entirely on a deep-linked scan result.
 */
let navigationDepth = 0;

/**
 * Back navigation for the app bar and the edge-swipe gesture: pops in-app
 * history when there is some, otherwise walks up to the owning tab so a
 * deep link never dead-ends.
 */
export function useAppBack() {
  const router = useRouter();
  const pathname = usePathname();
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    navigationDepth += 1;
  }, [pathname]);

  return React.useCallback(() => {
    if (navigationDepth > 0) {
      navigationDepth -= 1;
      router.back();
    } else {
      router.push(parentPath(pathname));
    }
  }, [router, pathname]);
}
