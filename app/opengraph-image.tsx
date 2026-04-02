import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0D1F3C",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        {/* Teal accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "6px",
            background: "#00C2A8",
          }}
        />

        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "40px",
          }}
        >
          <span style={{ color: "#00C2A8", fontSize: "32px", fontWeight: "bold" }}>▸</span>
          <span style={{ color: "#FFFFFF", fontSize: "32px", fontWeight: "bold" }}>LaneBrief</span>
        </div>

        {/* Headline */}
        <h1
          style={{
            color: "#FFFFFF",
            fontSize: "64px",
            fontWeight: "bold",
            lineHeight: 1.15,
            margin: 0,
            maxWidth: "900px",
          }}
        >
          Freight Intelligence
          <br />
          <span style={{ color: "#00C2A8" }}>for Independent Brokers.</span>
        </h1>

        {/* Subtext */}
        <p
          style={{
            color: "#6B7B8D",
            fontSize: "28px",
            marginTop: "32px",
            maxWidth: "800px",
          }}
        >
          Lane analysis · Rate forecasts · Freight market data · $199/month
        </p>

        {/* Domain */}
        <p
          style={{
            position: "absolute",
            bottom: "60px",
            right: "80px",
            color: "#00C2A8",
            fontSize: "22px",
            fontWeight: "bold",
          }}
        >
          lanebrief.com
        </p>
      </div>
    ),
    { ...size }
  );
}
