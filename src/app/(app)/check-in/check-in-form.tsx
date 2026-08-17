"use client";

import { useState, useTransition } from "react";
import { Camera, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { resizeImageForUpload } from "@/lib/image-resize";
import { haptic } from "@/lib/haptics";
import { submitCheckIn } from "./actions";

export function CheckInForm() {
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isResizing, setIsResizing] = useState(false);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>, onPreview?: (url: string | null) => void) {
    const input = e.target;
    const file = input.files?.[0];
    onPreview?.(file ? URL.createObjectURL(file) : null);
    if (!file) return;

    setIsResizing(true);
    try {
      const resized = await resizeImageForUpload(file);
      if (resized !== file) {
        const dt = new DataTransfer();
        dt.items.add(resized);
        input.files = dt.files;
      }
    } finally {
      setIsResizing(false);
    }
  }

  return (
    <form
      action={(formData) => startTransition(() => submitCheckIn(formData))}
      className="flex flex-col gap-4 md:gap-6"
    >
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Take your photo
          </CardTitle>
          <CardDescription>
            Face the camera straight-on in even light, neutral expression. This is what gets
            analyzed — the clearer it is, the more accurate your results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Portrait on a phone (a selfie is portrait, and the target
              should fill the thumb's reach), landscape from sm: up. */}
          <label
            htmlFor="photo_front"
            className="press flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground active:border-primary/60 sm:aspect-[4/3]"
          >
            {frontPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={frontPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <>
                <Camera className="size-9" />
                <span className="text-sm font-medium">Tap to take or upload a selfie</span>
                <span className="text-xs">Required — JPG or PNG</span>
              </>
            )}
          </label>
          <input
            id="photo_front"
            name="photo_front"
            type="file"
            accept="image/*"
            capture="user"
            required
            className="sr-only"
            onChange={(e) => handlePhotoChange(e, setFrontPreview)}
          />
        </CardContent>
      </Card>

      {/* Sticks to the bottom of the viewport on mobile, above the tab bar,
          so the primary action is always reachable however far down the
          form you've scrolled. */}
      <div className="sticky bottom-tabsafe z-30 -mx-4 border-t border-border/60 bg-background/85 px-4 py-3 backdrop-blur-xl md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isPending || isResizing}
          onClick={() => haptic("impact")}
        >
          {isPending ? "Uploading…" : isResizing ? "Preparing photo…" : "Analyze my face"}
        </Button>
      </div>
    </form>
  );
}
