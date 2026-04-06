import { ImageResponse } from "next/og";

export const runtime = "edge";
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
          background: "#0D1F3C",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#00C2A8",
              lineHeight: 1,
              letterSpacing: "-3px",
            }}
          >
            LB
          </span>
          <div
            style={{
              width: 44,
              height: 3,
              background: "#00C2A8",
              borderRadius: 2,
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
