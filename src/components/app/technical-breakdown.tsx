"use client";

import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetTrigger,
} from "@/components/ui/bottom-sheet";
import { CONCERN_META } from "@/lib/concerns";
import type { YouCamConcern } from "@/lib/youcam/types";

export interface ConcernScore {
  concern: YouCamConcern;
  uiScore: number;
  hasMask?: boolean;
}

/** Raw per-concern detail behind the four rolled-up metrics — the "clear technical understanding" beyond just four headline numbers. */
export function TechnicalBreakdown({ concerns, scanId }: { concerns: ConcernScore[]; scanId: string }) {
  const sorted = [...concerns].sort((a, b) => a.uiScore - b.uiScore);
  const photoSrc = `/api/photos/${scanId}/front`;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle>The technical read</CardTitle>
        <CardDescription>
          Raw signal from your photo, worst first — 100 is the healthiest a signal can score. Tap
          a heatmap to see exactly where it was detected.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {sorted.map((c) => {
          const meta = CONCERN_META[c.concern];
          const maskSrc = c.hasMask ? `/api/masks/${scanId}/${c.concern}` : null;
          return (
            <div key={c.concern} className="flex gap-3">
              {maskSrc ? (
                <BottomSheet>
                  <BottomSheetTrigger
                    render={
                      <button
                        type="button"
                        aria-label={`View ${meta.label} heatmap`}
                        className="press relative size-14 shrink-0 overflow-hidden rounded-md ring-1 ring-border/60 outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <Image src={photoSrc} alt="" fill sizes="56px" className="object-cover" />
                        <Image src={maskSrc} alt="" fill sizes="56px" className="object-cover" />
                      </button>
                    }
                  />
                  {/* Media-first, so the sheet bleeds: the photo runs edge
                      to edge on a phone the way a native photo viewer does. */}
                  <BottomSheetContent bleed>
                    <BottomSheetHeader className="px-4 pt-1 pb-3 sm:px-0 sm:pt-0">
                      <BottomSheetTitle>{meta.label}</BottomSheetTitle>
                      <BottomSheetDescription>{meta.description}</BottomSheetDescription>
                    </BottomSheetHeader>
                    <div className="relative aspect-[3/4] w-full overflow-hidden sm:rounded-lg">
                      <Image src={photoSrc} alt="" fill sizes="(max-width: 640px) 100vw, 448px" className="object-cover" />
                      <Image
                        src={maskSrc}
                        alt={`${meta.label} heatmap`}
                        fill
                        sizes="(max-width: 640px) 100vw, 448px"
                        className="object-cover"
                      />
                    </div>
                  </BottomSheetContent>
                </BottomSheet>
              ) : (
                <div className="size-14 shrink-0 rounded-md bg-muted" />
              )}
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{meta.label}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {c.uiScore}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${c.uiScore}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
