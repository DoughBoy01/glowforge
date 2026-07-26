import { ImageResponse } from "next/og";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg, #1b1b1f 0%, #101012 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 72,
              height: 72,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #26262c 0%, #151517 100%)",
              fontSize: 40,
              fontWeight: 800,
              color: "#f0803c",
            }}
          >
            G
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#f5f5f0" }}>
            {APP_NAME}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 56, fontWeight: 800, color: "#f5f5f0", maxWidth: 900 }}>
          {APP_TAGLINE}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#9a9aa2", marginTop: 24 }}>
          Sun Damage · Firmness · Eye Area · Moisture
        </div>
      </div>
    ),
    { ...size },
  );
}
