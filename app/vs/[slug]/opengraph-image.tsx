import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 2592000; // 30 days

const COMPETITORS: Record<string, { name: string; shortName: string; pricing: string }> = {
  freightwaves: { name: "FreightWaves SONAR", shortName: "FreightWaves", pricing: "$2,500–$5,000/mo" },
  "dat-market-conditions": { name: "DAT Market Conditions", shortName: "DAT", pricing: "$150+/mo" },
  truckstop: { name: "Truckstop", shortName: "Truckstop", pricing: "$150–$400/mo" },
};

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = COMPETITORS[slug];
  if (!c) notFound();

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
        {/* Top teal accent bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "6px", background: "#00C2A8" }} />

        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "36px" }}>
          <span style={{ color: "#00C2A8", fontSize: "24px", fontWeight: "bold" }}>▸</span>
          <span style={{ color: "#FFFFFF", fontSize: "24px", fontWeight: "bold" }}>LaneBrief</span>
        </div>

        {/* VS comparison badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "28px" }}>
          <div
            style={{
              background: "#00C2A8",
              color: "#0D1F3C",
              borderRadius: "12px",
              padding: "18px 32px",
              fontSize: "38px",
              fontWeight: "bold",
              display: "flex",
            }}
          >
            LaneBrief
          </div>
          <span style={{ color: "#6B7B8D", fontSize: "38px", fontWeight: "bold", display: "flex" }}>vs</span>
          <div
            style={{
              background: "#1A3A5C",
              color: "#A0AEC0",
              borderRadius: "12px",
              padding: "18px 32px",
              fontSize: "38px",
              fontWeight: "bold",
              display: "flex",
            }}
          >
            {c.shortName}
          </div>
        </div>

        {/* Subheadline */}
        <div
          style={{
            color: "#FFFFFF",
            fontSize: "26px",
            textAlign: "center",
            maxWidth: "780px",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            lineHeight: 1.4,
          }}
        >
          Which freight intelligence platform is built for independent brokers?
        </div>

        {/* Pricing comparison */}
        <div
          style={{
            display: "flex",
            gap: "32px",
            marginTop: "32px",
            alignItems: "center",
          }}
        >
          <div
            style={{
              background: "#0F2540",
              borderRadius: "8px",
              padding: "12px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ color: "#A0AEC0", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex" }}>LaneBrief</span>
            <span style={{ color: "#00C2A8", fontSize: "22px", fontWeight: "bold", display: "flex" }}>from $49/mo</span>
          </div>
          <div
            style={{
              background: "#0F2540",
              borderRadius: "8px",
              padding: "12px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ color: "#A0AEC0", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex" }}>{c.shortName}</span>
            <span style={{ color: "#6B7B8D", fontSize: "22px", fontWeight: "bold", display: "flex" }}>{c.pricing}</span>
          </div>
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            color: "#00C2A8",
            fontSize: "18px",
            fontWeight: "bold",
            display: "flex",
          }}
        >
          lanebrief.com
        </div>
      </div>
    ),
    { ...size }
  );
}
