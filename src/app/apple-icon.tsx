import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #26262c 0%, #151517 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 100,
            fontWeight: 800,
            fontFamily: "sans-serif",
            color: "#f0803c",
            letterSpacing: -2,
          }}
        >
          S
        </div>
      </div>
    ),
    { ...size },
  );
}
