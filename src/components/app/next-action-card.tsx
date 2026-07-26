import Link from "next/link";
import { ChevronRight, ListChecks, ScanFace, Check, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { NextAction } from "@/lib/home";
import { cn } from "@/lib/utils";

const ICONS: Record<NextAction["kind"], LucideIcon> = {
  check_in: ScanFace,
  build_routine: Sparkles,
  log_routine: ListChecks,
  on_track: Check,
};

/**
 * The home screen's one instruction, as a single tappable card.
 *
 * Styled as the loud thing on the screen while there's something to do, and
 * deliberately quiet once there isn't — an "all clear" state that shouts is
 * how people learn to ignore the prompt that matters.
 */
export function NextActionCard({
  action,
  className,
}: {
  action: NextAction;
  className?: string;
}) {
  const Icon = ICONS[action.kind];
  const done = action.kind === "on_track";

  return (
    <Link
      href={action.href}
      className={cn("block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}
    >
      <Card
        className={cn(
          "press h-full transition-colors",
          done
            ? "border-border/60 active:bg-muted/50"
            : "border-primary/40 bg-primary/[0.06] active:bg-primary/12",
        )}
      >
        <CardContent className="flex items-center gap-4">
          <span
            className={cn(
              "flex size-11 shrink-0 -skew-x-6 items-center justify-center rounded-md",
              done
                ? "bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground dark:shadow-[2px_2px_0] dark:shadow-accent/50",
            )}
          >
            <Icon className="size-5 skew-x-6" strokeWidth={2.1} />
          </span>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span
              className={cn(
                "font-mono text-[0.625rem] font-bold tracking-[0.16em] uppercase",
                done ? "text-muted-foreground" : "text-primary",
              )}
            >
              {done ? "Nothing due" : "Up next"}
            </span>
            <span className="font-heading leading-snug">{action.title}</span>
            <span className="text-sm text-balance text-muted-foreground">{action.body}</span>
          </div>

          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
