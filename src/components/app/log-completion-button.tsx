"use client";

import { useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logCompletionAction } from "@/app/(app)/routine/actions";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export function LogCompletionButton({
  routineId,
  doneToday,
  /** The mobile card layout puts this at the foot of the card, edge to edge. */
  fullWidth = false,
}: {
  routineId: string;
  doneToday: boolean;
  fullWidth?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size={fullWidth ? "lg" : "sm"}
      variant={doneToday ? "secondary" : "default"}
      disabled={doneToday || isPending}
      className={cn(fullWidth && "w-full")}
      onClick={() =>
        startTransition(() => {
          haptic("success");
          return logCompletionAction(routineId);
        })
      }
    >
      <CheckCircle2 className="size-4" />
      {doneToday ? "Done today" : isPending ? "Logging…" : "Log today"}
    </Button>
  );
}
