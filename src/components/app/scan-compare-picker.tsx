"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export interface ComparableScan {
  id: string;
  label: string;
}

/**
 * Picks the two check-ins the compare view diffs. Selection lives in the
 * URL rather than component state so a given comparison is linkable and
 * survives a refresh — the page itself stays a server component.
 */
export function ScanComparePicker({
  scans,
  fromId,
  toId,
}: {
  scans: ComparableScan[];
  fromId: string;
  toId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const labels = new Map(scans.map((s) => [s.id, s.label]));

  const go = (next: { from?: string; to?: string }) => {
    const params = new URLSearchParams({
      from: next.from ?? fromId,
      to: next.to ?? toId,
    });
    startTransition(() => router.push(`/scans/compare?${params}`));
  };

  return (
    <div
      // Two equal columns on a phone — the two fixed-width selects and the
      // arrow between them wrapped into an unreadable stack.
      className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap"
      data-pending={isPending ? "" : undefined}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="compare-from" className="text-xs text-muted-foreground">
          Baseline
        </Label>
        <Select
          value={fromId}
          onValueChange={(value: unknown) => go({ from: String(value) })}
        >
          <SelectTrigger id="compare-from" className="w-full sm:w-44">
            <SelectValue>{(value: unknown) => labels.get(String(value)) ?? "Pick a scan"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {scans.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ArrowRight className="mb-2.5 hidden size-4 text-muted-foreground sm:block" />

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="compare-to" className="text-xs text-muted-foreground">
          Compared to
        </Label>
        <Select
          value={toId}
          onValueChange={(value: unknown) => go({ to: String(value) })}
        >
          <SelectTrigger id="compare-to" className="w-full sm:w-44">
            <SelectValue>{(value: unknown) => labels.get(String(value)) ?? "Pick a scan"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {scans.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
