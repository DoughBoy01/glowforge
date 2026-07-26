"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Segmented appearance control. "System" is the default, so the app tracks
 * the OS the way a native app does; the explicit options are for people who
 * run their phone light but want this dark (or the reverse).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // `theme` is only known client-side, so the selected segment can't be
  // rendered on the server without a hydration mismatch.
  React.useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1"
    >
      {OPTIONS.map((option) => {
        const selected = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              haptic("select");
              setTheme(option.value);
            }}
            className={cn(
              "press flex min-h-11 flex-col items-center justify-center gap-1 rounded-md outline-none transition-colors",
              "font-mono text-[0.625rem] font-bold tracking-[0.12em] uppercase",
              "focus-visible:ring-3 focus-visible:ring-ring/50",
              selected
                ? "bg-background text-foreground ring-1 ring-border"
                : "text-muted-foreground active:bg-background/50",
            )}
          >
            <option.icon className="size-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
