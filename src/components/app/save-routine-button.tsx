"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, Check, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveGeneratedRoutinesAction } from "@/app/(app)/routine/actions";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * One tap between "here's your plan" and "this is my routine".
 *
 * The scan id is all that crosses the wire — the server rebuilds the plan
 * from the scores rather than trusting anything sent from here.
 *
 * After saving it becomes a link rather than navigating on its own: the
 * results page underneath is the reason the user is here, and yanking them
 * off it is a worse trade than one extra tap.
 */
export function SaveRoutineButton({
  scanId,
  label = "Save this as my routine",
  className,
}: {
  scanId?: string;
  label?: string;
  className?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (saved) {
    return (
      <Button
        size="lg"
        variant="secondary"
        className={cn("gap-2", className)}
        render={
          <Link href="/routine">
            <Check className="size-4" />
            Saved — open your routine
            <ArrowRight className="size-4" />
          </Link>
        }
      />
    );
  }

  return (
    <Button
      size="lg"
      disabled={isPending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          const result = await saveGeneratedRoutinesAction(scanId);
          if (!result?.ok) {
            toast.error("Couldn't save that routine. Try again in a moment.");
            return;
          }
          haptic("success");
          setSaved(true);
          toast.success("Routine saved.");
        })
      }
    >
      <ListChecks className="size-4" />
      {isPending ? "Saving…" : label}
    </Button>
  );
}
