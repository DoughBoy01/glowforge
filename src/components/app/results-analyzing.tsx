"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type Status = "pending" | "processing" | "succeeded" | "failed";

const STAGES = [
  "Uploading your photo…",
  "Detecting facial landmarks…",
  "Mapping skin concerns…",
  "Calculating your scores…",
];

/**
 * Full-page "analyzing" state for a fresh, photo-only check-in — there's
 * nothing else on the page yet to show, so this owns the primary content
 * slot rather than being a small banner. Polls the same status endpoint as
 * the dashboard's AnalysisStatus and hands off to a `router.refresh()` once
 * the analysis lands; the server component then renders real results.
 */
export function ResultsAnalyzing({
  scanId,
  initialStatus,
}: {
  scanId: string;
  initialStatus: Status;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (status !== "pending" && status !== "processing") return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/scans/${scanId}/analysis`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { status: Status };
        if (cancelled) return;
        setStatus(data.status);
        if (data.status === "succeeded" || data.status === "failed") {
          router.refresh();
        }
      } catch {
        // Transient network hiccup — the next interval retries.
      }
    };

    poll();
    const pollId = setInterval(poll, 2500);
    const stageId = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 3500);
    return () => {
      cancelled = true;
      clearInterval(pollId);
      clearInterval(stageId);
    };
  }, [status, scanId, router]);

  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <div>
          <div className="text-lg font-semibold">Analyzing your face</div>
          <div className="mt-1 text-sm text-muted-foreground">{STAGES[stage]}</div>
        </div>
        <Progress value={((stage + 1) / STAGES.length) * 100} className="w-full max-w-xs" />
        <p className="max-w-sm text-xs text-muted-foreground">
          Usually takes under a minute. This page updates on its own — no need to refresh.
        </p>
      </CardContent>
    </Card>
  );
}
