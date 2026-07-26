"use client";

import { useState, useTransition } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
} from "@/components/ui/bottom-sheet";
import { CopyLinkButton } from "@/components/app/copy-link-button";
import { haptic } from "@/lib/haptics";
import { createShareForScan } from "@/app/(app)/dashboard/actions";

/**
 * Passing `compareScanId` shares a before/after card (the two scans side by
 * side) instead of a single result — same flow, different card kind.
 */
export function ShareButton({
  scanId,
  compareScanId,
  label = "Share results",
  /** Callers stacking actions on mobile pass `w-full`. */
  className,
}: {
  scanId: string;
  compareScanId?: string;
  label?: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isComparison = !!compareScanId;

  function share() {
    startTransition(async () => {
      const link = await createShareForScan(scanId, compareScanId);
      haptic("success");

      // On a phone, the OS share sheet is the expected destination — it
      // reaches Messages, AirDrop and everything else the user already
      // has, which a copy-link dialog can't. Only offered where the
      // browser can actually complete it; desktop falls through to the
      // sheet below.
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: isComparison ? "My progress" : "My skin check-in",
            url: link,
          });
          return;
        } catch (error) {
          // Dismissing the OS sheet rejects with AbortError — that's the
          // user saying no, not a failure to recover from.
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }

      setUrl(link);
      setOpen(true);
    });
  }

  return (
    <>
      <Button variant="outline" disabled={isPending} onClick={share} className={className}>
        <Share2 className="size-4" />
        {isPending ? "Creating…" : label}
      </Button>
      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle>Your progress card is live</BottomSheetTitle>
            <BottomSheetDescription>
              Anyone with this link can view a read-only version of{" "}
              {isComparison ? "this before-and-after." : "this check-in."}
            </BottomSheetDescription>
          </BottomSheetHeader>
          {url && <CopyLinkButton value={url} />}
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}
