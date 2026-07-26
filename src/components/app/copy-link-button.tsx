"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { haptic } from "@/lib/haptics";

export function CopyLinkButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    haptic("success");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {/* Focusing selects the whole link, so anyone who'd rather copy by
            hand doesn't have to fight text selection on a touchscreen. */}
        <Input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 font-mono text-sm"
        />
        <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Copy link">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
      {/* On a phone, handing the link to the OS share sheet beats copying it
          and then hunting for somewhere to paste. */}
      <Button
        type="button"
        size="lg"
        variant="secondary"
        className="w-full sm:hidden"
        onClick={async () => {
          if (typeof navigator === "undefined" || !navigator.share) {
            await copy();
            return;
          }
          try {
            await navigator.share({ url: value });
            haptic("success");
          } catch (error) {
            // Dismissing the OS sheet rejects with AbortError — a decision,
            // not a failure. Anything else falls back to the clipboard.
            if (!(error instanceof DOMException && error.name === "AbortError")) {
              await copy();
            }
          }
        }}
      >
        <Share2 className="size-4" />
        Share link
      </Button>
    </div>
  );
}
