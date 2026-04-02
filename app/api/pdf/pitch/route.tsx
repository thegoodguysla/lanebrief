import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { generateText } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Colours & fonts ──────────────────────────────────────────────────────────
const C = {
  navy: "#0D1F3C",
  teal: "#00C2A8",
  slate: "#6B7B8D",
  bg: "#F8FAFC",
  white: "#FFFFFF",
  border: "#E2EBF4",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: C.white,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 48,
    fontSize: 11,
    color: C.navy,
  },
  // Header
  header: {
    marginBottom: 24,
    borderBottomWidth: 3,
    borderBottomColor: C.teal,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  brokerName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
  },
  laneTitle: {
    fontSize: 13,
    color: C.slate,
    marginTop: 4,
  },
  dateBadge: {
    fontSize: 9,
    color: C.slate,
    textAlign: "right",
  },
  poweredBy: {
    fontSize: 8,
    color: C.teal,
    textAlign: "right",
    marginTop: 3,
    fontFamily: "Helvetica-Bold",
  },
  // Section
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.teal,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  card: {
    backgroundColor: C.bg,
    borderRadius: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  // Lane overview grid
  grid: {
    flexDirection: "row",
    gap: 12,
  },
  gridCell: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 4,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  gridLabel: {
    fontSize: 8,
    color: C.slate,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  gridValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
  },
  // Rate analysis
  rateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  rateLabel: {
    fontSize: 10,
    color: C.slate,
  },
  rateValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
  },
  trendPill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  confidenceNote: {
    fontSize: 8,
    color: C.slate,
    marginTop: 6,
    fontStyle: "italic",
  },
  // Bullets
  bullet: {
    flexDirection: "row",
    marginBottom: 8,
    alignItems: "flex-start",
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.teal,
    marginTop: 3,
    marginRight: 10,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: 11,
    color: C.navy,
    lineHeight: 1.5,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeft: {
    fontSize: 8,
    color: C.slate,
  },
  footerRight: {
    fontSize: 8,
    color: C.teal,
    fontFamily: "Helvetica-Bold",
  },
});

// ─── AI data types ─────────────────────────────────────────────────────────────
type PitchAIData = {
  rate_low: number;
  rate_high: number;
  trend: "up" | "flat" | "down";
  confidence_label: string;
  bullets: string[];
};

async function generatePitchData(
  origin: string,
  destination: string
): Promise<PitchAIData> {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const prompt = `You are a freight market intelligence analyst. Generate a professional shipper pitch data package for a dry van lane from ${origin} to ${destination} in ${dateStr}.

Respond with ONLY a JSON object (no markdown, no explanation) in this exact format:
{
  "rate_low": <number, realistic low end spot $/mile, 2 decimal places>,
  "rate_high": <number, realistic high end spot $/mile, 2 decimal places>,
  "trend": <"up" | "flat" | "down" — current rate trend>,
  "confidence_label": <string, 4-8 words, e.g. "Moderate confidence — seasonal data">,
  "bullets": [
    "<2-3 sentences of freight intelligence insight about this lane — reliability, carrier availability, seasonal patterns, or market opportunity>",
    "<second insight>",
    "<third insight>"
  ]
}

Rules:
- rate_low and rate_high: realistic spot market range for this lane, rate_high should be 10-20% above rate_low
- trend: based on typical seasonal patterns for this time of year
- bullets: specific, actionable insights a freight broker could use in a shipper pitch — mention actual lane characteristics, not generic advice`;

  const { text } = await generateText({
    model: "anthropic/claude-haiku-4.5",
    prompt,
    maxOutputTokens: 512,
  });

  return JSON.parse(text.trim()) as PitchAIData;
}

// ─── PDF Document ──────────────────────────────────────────────────────────────
function PitchDocument({
  origin,
  destination,
  brokerName,
  data,
  date,
}: {
  origin: string;
  destination: string;
  brokerName: string;
  data: PitchAIData;
  date: string;
}) {
  const trendColor =
    data.trend === "up" ? "#22C55E" : data.trend === "down" ? "#EF4444" : C.slate;
  const trendLabel =
    data.trend === "up" ? "▲ Rising" : data.trend === "down" ? "▼ Falling" : "→ Stable";

  return (
    <Document title={`${origin} → ${destination} — Lane Intelligence Brief`}>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brokerName}>{brokerName}</Text>
            <Text style={styles.laneTitle}>
              Lane Intelligence Brief · {origin} → {destination}
            </Text>
          </View>
          <View>
            <Text style={styles.dateBadge}>{date}</Text>
            <Text style={styles.poweredBy}>Powered by LaneBrief</Text>
          </View>
        </View>

        {/* Lane Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lane Overview</Text>
          <View style={styles.grid}>
            <View style={styles.gridCell}>
              <Text style={styles.gridLabel}>Origin</Text>
              <Text style={styles.gridValue}>{origin}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.gridLabel}>Destination</Text>
              <Text style={styles.gridValue}>{destination}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.gridLabel}>Equipment</Text>
              <Text style={styles.gridValue}>Dry Van</Text>
            </View>
          </View>
        </View>

        {/* Market Rate Analysis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Market Rate Analysis</Text>
          <View style={styles.card}>
            <View style={styles.rateRow}>
              <Text style={styles.rateLabel}>Estimated Spot Range</Text>
              <Text style={styles.rateValue}>
                ${data.rate_low.toFixed(2)} – ${data.rate_high.toFixed(2)}/mile
              </Text>
            </View>
            <View style={styles.rateRow}>
              <Text style={styles.rateLabel}>Current Trend</Text>
              <Text
                style={[
                  styles.trendPill,
                  { backgroundColor: trendColor + "22", color: trendColor },
                ]}
              >
                {trendLabel}
              </Text>
            </View>
            <Text style={styles.confidenceNote}>
              {data.confidence_label} · AI-estimated from training data. Not a substitute for live market rates.
            </Text>
          </View>
        </View>

        {/* Why This Lane */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why This Lane</Text>
          <View style={styles.card}>
            {data.bullets.map((bullet, i) => (
              <View key={i} style={styles.bullet}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>
            Confidential · Prepared for {brokerName} · {date}
          </Text>
          <Text style={styles.footerRight}>LaneBrief Intelligence · lanebrief.com</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Route Handler ──────────────────────────────────────────────────────────────
type PitchRequest = {
  lane: { origin: string; destination: string };
  broker_name?: string;
  logo_url?: string | null;
};

export async function POST(request: Request) {
  let body: PitchRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { lane, broker_name } = body;

  if (!lane?.origin || !lane?.destination) {
    return Response.json(
      { error: "Missing required fields: lane.origin, lane.destination" },
      { status: 400 }
    );
  }

  const origin = lane.origin.trim();
  const destination = lane.destination.trim();
  const brokerName = broker_name?.trim() || "LaneBrief";
  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  let pitchData: PitchAIData;
  try {
    pitchData = await generatePitchData(origin, destination);
  } catch (err) {
    console.error("[pdf/pitch] AI generation error:", err);
    return Response.json({ error: "AI service unavailable" }, { status: 503 });
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(
      <PitchDocument
        origin={origin}
        destination={destination}
        brokerName={brokerName}
        data={pitchData}
        date={date}
      />
    );
  } catch (err) {
    console.error("[pdf/pitch] PDF render error:", err);
    return Response.json({ error: "PDF generation failed" }, { status: 500 });
  }

  const filename = `lanebrief-pitch-${origin.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-to-${destination.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
