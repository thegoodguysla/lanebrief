import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Dynamic OG image endpoint
// Types:
//   ?type=lane&origin=Chicago,IL&destination=Dallas,TX&rate=2.84&forecast=up&delta=8.4
//   ?type=vs&competitor=FreightWaves&pricing=%242%2C500%2Fmo
//   ?type=social&headline=Rate+Alerts+Now+Live&sub=Get+SMS+when+your+lanes+move

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "social";

  if (type === "lane") {
    return laneBriefOg(searchParams);
  }
  if (type === "vs") {
    return vsPageOg(searchParams);
  }
  return socialCardOg(searchParams);
}

// ── Lane Rate Share Card ─────────────────────────────────────────────────────

function laneBriefOg(p: URLSearchParams) {
  const origin = p.get("origin") ?? "Origin";
  const destination = p.get("destination") ?? "Destination";
  const rate = parseFloat(p.get("rate") ?? "0");
  const forecast = p.get("forecast") ?? "flat"; // up | down | flat
  const delta = parseFloat(p.get("delta") ?? "0");

  const isUp = forecast === "up";
  const isDown = forecast === "down";
  const arrowColor = isUp ? "#EF4444" : isDown ? "#00C2A8" : "#94A3B8";
  const arrowChar = isUp ? "▲" : isDown ? "▼" : "→";
  const deltaLabel = delta !== 0 ? `${isUp ? "+" : ""}${delta.toFixed(1)}%` : "flat";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#0D1F3C",
          display: "flex",
          flexDirection: "column",
          padding: "64px 80px",
          fontFamily: "Arial, sans-serif",
          position: "relative",
        }}
      >
        {/* Top accent bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "6px", background: "#00C2A8" }} />

        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "48px" }}>
          <span style={{ color: "#00C2A8", fontSize: "28px", fontWeight: "bold" }}>▸</span>
          <span style={{ color: "#FFFFFF", fontSize: "28px", fontWeight: "bold" }}>LaneBrief</span>
        </div>

        {/* Lane */}
        <div style={{ color: "#A0AEC0", fontSize: "22px", marginBottom: "12px", display: "flex" }}>
          Rate Alert
        </div>
        <div style={{ color: "#FFFFFF", fontSize: "52px", fontWeight: "bold", lineHeight: 1.1, marginBottom: "40px", display: "flex" }}>
          {origin} → {destination}
        </div>

        {/* Rate badge */}
        <div style={{ display: "flex", gap: "32px", alignItems: "flex-end" }}>
          <div
            style={{
              background: "#1A3A5C",
              borderRadius: "12px",
              padding: "24px 36px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <span style={{ color: "#A0AEC0", fontSize: "16px", textTransform: "uppercase", letterSpacing: "0.1em", display: "flex" }}>
              Market Rate
            </span>
            <span style={{ color: "#FFFFFF", fontSize: "48px", fontWeight: "bold", display: "flex" }}>
              ${rate.toFixed(2)}<span style={{ color: "#A0AEC0", fontSize: "28px", alignSelf: "flex-end", marginBottom: "6px", display: "flex" }}>/mi</span>
            </span>
          </div>

          <div
            style={{
              background: isUp ? "#2D1A1A" : isDown ? "#0F2A25" : "#1A2A3A",
              borderRadius: "12px",
              padding: "24px 36px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <span style={{ color: "#A0AEC0", fontSize: "16px", textTransform: "uppercase", letterSpacing: "0.1em", display: "flex" }}>
              This Week
            </span>
            <span style={{ color: arrowColor, fontSize: "48px", fontWeight: "bold", display: "flex" }}>
              {arrowChar} {deltaLabel}
            </span>
          </div>
        </div>

        {/* Bottom */}
        <div
          style={{
            position: "absolute",
            bottom: "48px",
            right: "80px",
            color: "#00C2A8",
            fontSize: "20px",
            fontWeight: "bold",
            display: "flex",
          }}
        >
          lanebrief.com
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

// ── VS Comparison Card ───────────────────────────────────────────────────────

function vsPageOg(p: URLSearchParams) {
  const competitor = p.get("competitor") ?? "Competitor";
  const pricing = p.get("pricing") ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#0D1F3C",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "6px", background: "#00C2A8" }} />

        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "32px" }}>
          <span style={{ color: "#00C2A8", fontSize: "24px", fontWeight: "bold" }}>▸</span>
          <span style={{ color: "#FFFFFF", fontSize: "24px", fontWeight: "bold" }}>LaneBrief</span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              background: "#00C2A8",
              color: "#0D1F3C",
              borderRadius: "12px",
              padding: "16px 28px",
              fontSize: "36px",
              fontWeight: "bold",
              display: "flex",
            }}
          >
            LaneBrief
          </div>
          <span style={{ color: "#6B7B8D", fontSize: "36px", display: "flex" }}>vs</span>
          <div
            style={{
              background: "#1A3A5C",
              color: "#A0AEC0",
              borderRadius: "12px",
              padding: "16px 28px",
              fontSize: "36px",
              fontWeight: "bold",
              display: "flex",
            }}
          >
            {competitor}
          </div>
        </div>

        <div style={{ color: "#FFFFFF", fontSize: "28px", fontWeight: "bold", textAlign: "center", maxWidth: "800px", display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
          Which freight intelligence platform is right for independent brokers?
        </div>

        {pricing && (
          <div style={{ color: "#A0AEC0", fontSize: "20px", marginTop: "20px", display: "flex" }}>
            {competitor} starts at {pricing} · LaneBrief starts at $49/mo
          </div>
        )}

        <div style={{ position: "absolute", bottom: "40px", color: "#00C2A8", fontSize: "18px", fontWeight: "bold", display: "flex" }}>
          lanebrief.com
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

// ── Generic Social Post Card ─────────────────────────────────────────────────

function socialCardOg(p: URLSearchParams) {
  const headline = p.get("headline") ?? "Real-time freight intelligence for independent brokers.";
  const sub = p.get("sub") ?? "";
  const badge = p.get("badge") ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#0D1F3C",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "Arial, sans-serif",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "6px", background: "#00C2A8" }} />

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "40px" }}>
          <span style={{ color: "#00C2A8", fontSize: "28px", fontWeight: "bold" }}>▸</span>
          <span style={{ color: "#FFFFFF", fontSize: "28px", fontWeight: "bold" }}>LaneBrief</span>
          {badge && (
            <span
              style={{
                background: "#00C2A8",
                color: "#0D1F3C",
                borderRadius: "6px",
                padding: "4px 12px",
                fontSize: "16px",
                fontWeight: "bold",
                marginLeft: "8px",
                display: "flex",
              }}
            >
              {badge}
            </span>
          )}
        </div>

        <div
          style={{
            color: "#FFFFFF",
            fontSize: "60px",
            fontWeight: "bold",
            lineHeight: 1.15,
            maxWidth: "900px",
            display: "flex",
            flexWrap: "wrap",
          }}
        >
          {headline}
        </div>

        {sub && (
          <div style={{ color: "#6B7B8D", fontSize: "26px", marginTop: "28px", maxWidth: "800px", display: "flex" }}>
            {sub}
          </div>
        )}

        <div
          style={{
            position: "absolute",
            bottom: "60px",
            right: "80px",
            color: "#00C2A8",
            fontSize: "20px",
            fontWeight: "bold",
            display: "flex",
          }}
        >
          lanebrief.com
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
