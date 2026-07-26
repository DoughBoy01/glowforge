"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { isSubScreen, screenTitle } from "@/lib/nav";
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
  const router = useRouter();
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
                router.back();
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
            className="press-sm ml-1 flex min-w-0 flex-1 items-center gap-2.5 outline-none"
          >
            <span className="flex size-7 -skew-x-6 items-center justify-center bg-primary font-mono text-sm font-bold text-primary-foreground dark:shadow-[2px_2px_0] dark:shadow-accent/50">
              G
            </span>
            <span className="truncate font-script text-2xl text-primary dark:[text-shadow:0_0_14px_rgba(255,46,136,.8),0_0_40px_rgba(255,46,136,.4)]">
              {APP_NAME}
            </span>
          </Link>
        )}
      </div>
    </header>
  );
}
