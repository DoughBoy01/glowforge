"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PrimeMoveCard } from "@/components/app/prime-move-card";
import type { PrimeMove } from "@/lib/prime-move";

interface PartnerPick {
  slug: string;
  title: string;
  description: string | null;
  targetUrl: string;
}

/**
 * The routine page's empty state, split into two tabs rather than one card
 * stacked over another. "Just one thing" is selected first — the default a
 * man who's never run a routine actually gets — and "Full routine" is one
 * tap away rather than a scroll away, for anyone who wants the whole plan
 * from the start.
 *
 * Nothing is saved by switching tabs; `SaveRoutineButton` further down the
 * page still only ever builds the full routine. This is a display default,
 * not a data one — what you can look at first, not what you're committed to.
 */
export function RoutinePlanTabs({
  primeMove,
  partner,
  fullRoutine,
}: {
  primeMove: PrimeMove;
  partner: PartnerPick | null;
  /** Server-rendered `<DailyRoutinePlan />`, passed in rather than built here. */
  fullRoutine: React.ReactNode;
}) {
  const [tab, setTab] = React.useState("one-thing");

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
      <TabsList>
        <TabsTrigger value="one-thing">Just one thing</TabsTrigger>
        <TabsTrigger value="full">Full routine</TabsTrigger>
      </TabsList>
      <TabsContent value="one-thing">
        <PrimeMoveCard move={primeMove} partner={partner} onSeeFullRoutine={() => setTab("full")} />
      </TabsContent>
      <TabsContent value="full">{fullRoutine}</TabsContent>
    </Tabs>
  );
}
