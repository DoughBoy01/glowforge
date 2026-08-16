"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { isSubScreen, screenTitle } from "@/lib/nav";
import { useAppBack } from "@/hooks/use-app-back";
import { haptic } from "@/lib/haptics";

/**
 * The mobile app bar. Deliberately thin — navigation lives in the tab bar
 * at the bottom, so this only carries identity (on a tab root) or a back
 * affordance and a title (on a pushed screen), the way a native nav bar
 * does.
 *
 * No avatar, no account menu: a native app doesn't put "you are logged in"
 * in the chrome of every screen. Being in the app is the proof, and profile
 * and sign-out live under the "You" tab where they're expected.
 */
export function MobileAppBar() {
  const pathname = usePathname();
  // Not a bare `router.back()`: the manifest has a shortcut that launches
  // straight into /check-in, and since check-in became a pushed screen that's a
  // cold start with no in-app history to pop. Popping it anyway would close the
  // PWA on the first tap of a back button that's pointing at Home.
  const goBack = useAppBack();
  const nested = isSubScreen(pathname);

  return (
    <header
      data-app-chrome=""
      className="sticky top-0 z-40 border-b border-border/60 bg-background/85 pt-safe backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 md:hidden"
    >
      <div className="flex h-appbar items-center gap-1 px-safe [--gutter:0.5rem]">
        {nested ? (
          <>
            <button
              type="button"
              onClick={() => {
                haptic("select");
                goBack();
              }}
              className="press -ml-1 flex size-11 items-center justify-center rounded-lg text-foreground outline-none active:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronLeft className="size-6" />
              <span className="sr-only">Back</span>
            </button>
            <span className="min-w-0 flex-1 truncate font-mono text-xs font-bold tracking-[0.16em] uppercase">
              {screenTitle(pathname)}
            </span>
          </>
        ) : (
          <Link
            href="/dashboard"
            className="press-sm ml-1 flex min-w-0 flex-1 items-center gap-2 font-mono text-lg font-bold tracking-tight outline-none"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
              S
            </span>
            <span className="truncate">{APP_NAME}</span>
          </Link>
        )}
      </div>
    </header>
  );
}
