"use client";

import { useState, useTransition } from "react";
import { Camera, Sparkles, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TRACKED_METRICS, METRIC_META, type TrackedMetric } from "@/lib/metrics";
import { resizeImageForUpload } from "@/lib/image-resize";
import { haptic } from "@/lib/haptics";
import { submitCheckIn } from "./actions";

const SECONDARY_ANGLES = [
  { key: "left", label: "Left profile" },
  { key: "right", label: "Right profile" },
  { key: "eyes_close", label: "Eyes close-up" },
] as const;

type AngleKey = (typeof SECONDARY_ANGLES)[number]["key"];

export function CheckInForm() {
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [anglePreviews, setAnglePreviews] = useState<Partial<Record<AngleKey, string | null>>>({});
  const [manualOpen, setManualOpen] = useState(false);
  const [scores, setScores] = useState<Record<TrackedMetric, number>>({
    sun_damage: 60,
    firmness: 60,
    eye_area: 60,
    moisture: 60,
  });
  const [isPending, startTransition] = useTransition();
  // Counter, not a boolean — front + up to 3 angle photos can each be
  // resizing concurrently, and the submit button must stay disabled until
  // all of them settle, not just the last one to finish.
  const [resizingCount, setResizingCount] = useState(0);
  const isResizing = resizingCount > 0;

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>, onPreview?: (url: string | null) => void) {
    const input = e.target;
    const file = input.files?.[0];
    onPreview?.(file ? URL.createObjectURL(file) : null);
    if (!file) return;

    setResizingCount((c) => c + 1);
    try {
      const resized = await resizeImageForUpload(file);
      if (resized !== file) {
        const dt = new DataTransfer();
        dt.items.add(resized);
        input.files = dt.files;
      }
    } finally {
      setResizingCount((c) => c - 1);
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

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm">Additional angles</CardTitle>
          <CardDescription>Optional — helps with eye-area and profile-specific detail.</CardDescription>
        </CardHeader>
        {/* Tap-target tiles rather than the browser's native file input:
            that control renders as a ~24px button on mobile and gives no
            confirmation the photo was actually attached. */}
        <CardContent className="grid grid-cols-3 gap-3 sm:gap-4">
          {SECONDARY_ANGLES.map((angle) => (
            <div key={angle.key} className="flex flex-col gap-2">
              <label
                htmlFor={`photo_${angle.key}`}
                className="press flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground active:border-primary/60"
              >
                {anglePreviews[angle.key] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={anglePreviews[angle.key]!} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="size-5" />
                )}
              </label>
              <Label
                htmlFor={`photo_${angle.key}`}
                className="text-center text-xs leading-tight text-muted-foreground"
              >
                {angle.label}
              </Label>
              <input
                id={`photo_${angle.key}`}
                name={`photo_${angle.key}`}
                type="file"
                accept="image/*"
                capture="user"
                className="sr-only"
                onChange={(e) =>
                  handlePhotoChange(e, (url) =>
                    setAnglePreviews((prev) => ({ ...prev, [angle.key]: url })),
                  )
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <SlidersHorizontal className="size-4" /> Manual scoring
            </CardTitle>
            <CardDescription>
              {manualOpen
                ? "Your own read on each category — saved alongside the AI result."
                : "Off by default — your scores are calculated automatically from the photo above."}
            </CardDescription>
          </div>
          <Switch checked={manualOpen} onCheckedChange={setManualOpen} aria-label="Enable manual scoring" />
        </CardHeader>
        {manualOpen && (
          <CardContent className="flex flex-col gap-6">
            {TRACKED_METRICS.map((metric) => (
              <div key={metric} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <Label>{METRIC_META[metric].label}</Label>
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">
                    {scores[metric]}
                  </span>
                </div>
                <Slider
                  value={[scores[metric]]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(value) => {
                    const next = Array.isArray(value) ? value[0] : value;
                    setScores((prev) => ({ ...prev, [metric]: next }));
                  }}
                />
                <input type="hidden" name={metric} value={scores[metric]} />
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            name="notes"
            placeholder="Sleep, travel, product changes — anything that might explain a swing in scores."
            rows={3}
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
          {isPending ? "Uploading…" : isResizing ? "Preparing photo…" : "Analyze my skin"}
        </Button>
      </div>
    </form>
  );
}
