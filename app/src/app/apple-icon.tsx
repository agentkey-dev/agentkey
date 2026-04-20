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
          background: "#3B82F6",
          borderRadius: "36px",
          fontFamily: "system-ui, sans-serif",
          fontWeight: 800,
          fontSize: "110px",
          color: "#ffffff",
          letterSpacing: "-0.02em",
        }}
      >
        A
      </div>
    ),
    { ...size },
  );
}
