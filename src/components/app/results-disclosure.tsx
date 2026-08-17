"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * The results page's progressive-disclosure block — a summary row that's
 * always visible, with the dense content underneath collapsed by default.
 *
 * Takes its content via `children` rather than importing it directly: the
 * host page renders heavy server components (technical breakdown, daily
 * routine) and passes the finished JSX in, so this client wrapper never
 * pulls them into the client bundle itself — the same pattern
 * `RoutinePlanTabs` already uses for its `fullRoutine` slot.
 */
export function ResultsDisclosure({
  id,
  label,
  summary,
  defaultOpen = false,
  children,
  className,
}: {
  id?: string;
  label: string;
  summary: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("flex flex-col gap-3", className)}>
      <CollapsibleTrigger
        id={id}
        className="press hud-notch group flex items-center justify-between gap-3 border border-border/60 bg-card px-4 py-3 text-left scroll-mt-20 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
            {label}
          </span>
          <span className="truncate text-sm text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-panel-open:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
