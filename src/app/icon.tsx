import { ImageResponse } from "next/og";

export const contentType = "image/png";

const SIZES = [
  { size: 192 },
  { size: 512 },
];

export function generateImageMetadata() {
  return SIZES.map(({ size }) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType,
  }));
}

export default function Icon({ id }: { id: string }) {
  const size = Number(id);
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
          borderRadius: size * 0.2,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: size * 0.55,
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
    { width: size, height: size },
  );
}
