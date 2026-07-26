"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, TriangleAlert } from "lucide-react";

type Status = "pending" | "processing" | "succeeded" | "failed";

/**
 * Polls the analysis status endpoint while a scan's AI analysis is in
 * flight, then triggers a server-component refetch (`router.refresh`) once
 * it lands — the dashboard's normal data loading (metric scores, skin age,
 * category priorities) picks up the result, so this component only owns
 * the "still working" / "failed" banner, not the result rendering itself.
 */
export function AnalysisStatus({
  scanId,
  initialStatus,
}: {
  scanId: string;
  initialStatus: Status | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "pending" && status !== "processing") return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/scans/${scanId}/analysis`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { status: Status; errorMessage: string | null };
        if (cancelled) return;
        setStatus(data.status);
        setErrorMessage(data.errorMessage);
        if (data.status === "succeeded" || data.status === "failed") {
          router.refresh();
        }
      } catch {
        // Transient network hiccup — the next interval retries.
      }
    };

    poll();
    const id = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [status, scanId, router]);

  if (!status || status === "succeeded") return null;

  if (status === "failed") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <TriangleAlert className="size-4 shrink-0" />
        <span>
          AI analysis failed{errorMessage ? `: ${errorMessage}` : "."} Your manual scores are
          still saved.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      <Loader2 className="size-4 shrink-0 animate-spin" />
      Analyzing your photo — this usually takes under a minute.
    </div>
  );
}
