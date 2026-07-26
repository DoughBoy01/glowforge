"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemedUserButton } from "@/components/providers/clerk-themed";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { APP_NAME } from "@/lib/constants";
import { NAV_ITEMS, isNavItemActive } from "@/lib/nav";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2 py-1">
          <span className="flex h-7 w-7 -skew-x-6 items-center justify-center bg-primary font-mono text-sm font-bold text-primary-foreground dark:shadow-[2px_2px_0] dark:shadow-accent/50">
            G
          </span>
          {/* The neon bloom only reads as neon against the dark base. */}
          <span className="font-script text-2xl text-primary dark:[text-shadow:0_0_14px_rgba(255,46,136,.8),0_0_40px_rgba(255,46,136,.4)]">
            {APP_NAME}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isNavItemActive(pathname, item.href)}
                    render={
                      <Link href={item.href}>
                        <item.icon />
                        <span className="font-mono text-xs font-bold tracking-[0.14em] uppercase">
                          {item.label}
                        </span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1">
          <ThemedUserButton />
          <span className="text-sm text-muted-foreground">Account</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
