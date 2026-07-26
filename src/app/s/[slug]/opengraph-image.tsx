import { ImageResponse } from "next/og";
import { getDb } from "@/db";
import { getShareBySlug } from "@/db/queries/shares";
import { METRIC_META, TRACKED_METRICS, type TrackedMetric } from "@/lib/metrics";
import { APP_NAME } from "@/lib/constants";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function scoreFor(
  scan: { metricScores: { metricType: string; score: number }[] } | null | undefined,
  type: TrackedMetric | "overall",
) {
  return scan?.metricScores.find((m) => m.metricType === type)?.score ?? null;
}

export default async function ShareOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const share = await getShareBySlug(getDb(), slug);
  const overall = scoreFor(share?.scan, "overall") ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 80,
          background: "linear-gradient(135deg, #1b1b1f 0%, #101012 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                display: "flex",
                width: 56,
                height: 56,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                background: "#26262c",
                fontSize: 30,
                fontWeight: 800,
                color: "#f0803c",
              }}
            >
              G
            </div>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#f5f5f0" }}>
              {APP_NAME} progress card
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 140, fontWeight: 800, color: "#f0803c" }}>
                {overall}
              </div>
              <div style={{ display: "flex", fontSize: 24, color: "#9a9aa2" }}>
                Overall score
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {TRACKED_METRICS.map((metric) => (
                <div key={metric} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ display: "flex", width: 140, fontSize: 22, color: "#9a9aa2" }}>
                    {METRIC_META[metric].label}
                  </div>
                  <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#f5f5f0" }}>
                    {scoreFor(share?.scan, metric) ?? "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 22, color: "#9a9aa2" }}>
            Skin performance tracking, measured — not guessed.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
