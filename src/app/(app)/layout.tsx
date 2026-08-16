import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/app-sidebar";
import { BottomNav } from "@/components/app/bottom-nav";
import { MobileAppBar } from "@/components/app/mobile-app-bar";
import { AppShell } from "@/components/app/app-shell";
import { PostHogIdentify } from "@/components/providers/posthog-identify";
import { getDb } from "@/db";
import { getOrSyncUser, applyReferralIfNeeded } from "@/db/queries/users";
import { captureServerEvent } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = getDb();
  // Guarantees a D1 row exists even if the Clerk webhook hasn't landed yet
  // (e.g. immediately after sign-up).
  await getOrSyncUser(db, userId);

  const refCode = (await cookies()).get("gf_ref")?.value;
  if (refCode) {
    const updated = await applyReferralIfNeeded(db, userId, refCode);
    if (updated) {
      captureServerEvent({
        distinctId: userId,
        event: ANALYTICS_EVENTS.REFERRAL_SIGNUP,
        properties: { referredByCode: refCode },
      });
    }
  }

  return (
    <SidebarProvider>
      {/* Renders nothing on mobile — the tab bar below is the primary nav
          there, and the sidebar's off-canvas sheet has no trigger. */}
      <AppSidebar />
      <SidebarInset>
        <MobileAppBar />
        <header className="hidden h-14 items-center gap-2 border-b border-border/60 px-4 md:flex">
          <SidebarTrigger />
        </header>
        <AppShell>
          {/* pb-tabsafe clears the tab bar and the home indicator; from md:
              up there's neither, so it falls back to ordinary padding. */}
          <div className="flex-1 px-safe pt-4 pb-tabsafe [--gutter:1rem] md:pt-6 md:pb-6 md:[--gutter:1.5rem]">
            {children}
          </div>
        </AppShell>
        <BottomNav />
      </SidebarInset>
      <PostHogIdentify />
    </SidebarProvider>
  );
}
