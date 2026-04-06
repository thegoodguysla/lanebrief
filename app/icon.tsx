import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "20%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 200,
              fontWeight: 700,
              color: "#00C2A8",
              lineHeight: 1,
              letterSpacing: "-8px",
            }}
          >
            LB
          </span>
          <div
            style={{
              width: 120,
              height: 4,
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
