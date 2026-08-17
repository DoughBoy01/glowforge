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
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-2 py-1 font-mono text-lg font-bold tracking-tight"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
            S
          </span>
          {APP_NAME}
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
