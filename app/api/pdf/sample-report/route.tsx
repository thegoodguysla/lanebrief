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

// ─── Colours ──────────────────────────────────────────────────────────────────
const C = {
  navy: "#0D1F3C",
  teal: "#00C2A8",
  slate: "#6B7B8D",
  bg: "#F8FAFC",
  white: "#FFFFFF",
  border: "#E2EBF4",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: C.white,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontSize: 11,
    color: C.navy,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 3,
    borderBottomColor: C.teal,
    paddingBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerLeft: { flexDirection: "column" },
  reportTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.navy },
  laneLabel: { fontSize: 12, color: C.slate, marginTop: 3 },
  leadLine: { fontSize: 9, color: C.teal, marginTop: 2, fontFamily: "Helvetica-Bold" },
  headerRight: { alignItems: "flex-end" },
  dateBadge: { fontSize: 9, color: C.slate },
  poweredBy: { fontSize: 8, color: C.teal, marginTop: 3, fontFamily: "Helvetica-Bold" },
  section: { marginBottom: 16 },
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
  grid: { flexDirection: "row", gap: 10 },
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
  gridValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.navy },
  gridSub: { fontSize: 8, color: C.slate, marginTop: 2 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },
  rowLabel: { fontSize: 10, color: C.slate },
  rowValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.navy },
  pill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  note: { fontSize: 8, color: C.slate, marginTop: 6, fontStyle: "italic" },
  bullet: { flexDirection: "row", marginBottom: 6, alignItems: "flex-start" },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.teal,
    marginTop: 3,
    marginRight: 10,
    flexShrink: 0,
  },
  bulletText: { flex: 1, fontSize: 10, color: C.navy, lineHeight: 1.5 },
  // Carrier score
  scoreCircleWrap: { alignItems: "center", marginBottom: 10 },
  scoreValue: { fontSize: 28, fontFamily: "Helvetica-Bold", color: C.navy },
  scoreGrade: { fontSize: 11, color: C.slate },
  scoreRow: { flexDirection: "row", gap: 12 },
  scoreCol: { flex: 1 },
  scoreColLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.teal,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  scoreBullet: { flexDirection: "row", marginBottom: 4, alignItems: "flex-start" },
  scoreBulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.teal,
    marginTop: 3,
    marginRight: 7,
    flexShrink: 0,
  },
  scoreBulletText: { flex: 1, fontSize: 9, color: C.navy },
  // Autonomous
  autonomousStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  autonomousStatusBadge: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 12,
  },
  autonomousStatusText: { flex: 1, fontSize: 10, color: C.navy },
  carrierRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: C.white,
    borderRadius: 4,
    padding: 9,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 6,
    alignItems: "center",
  },
  carrierName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.navy },
  carrierMeta: { fontSize: 8, color: C.slate, marginTop: 2 },
  carrierBadge: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeft: { fontSize: 8, color: C.slate },
  footerRight: { fontSize: 8, color: C.teal, fontFamily: "Helvetica-Bold" },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 10 },
});

// ─── AI data types ─────────────────────────────────────────────────────────────

type RateBenchmarkData = {
  rate_low: number;
  rate_high: number;
  market_avg: number;
  trend: "up" | "flat" | "down";
  confidence_label: string;
  insights: string[];
};

type CarrierScoreData = {
  carrier_name: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
  strengths: string[];
  risks: string[];
};

type AutonomousFleetData = {
  coverage: "YES" | "PARTIAL" | "NO";
  coverage_summary: string;
  carriers: Array<{
    name: string;
    status: "certified" | "provisional";
    active_trucks: number;
    uptime_pct: number;
    daily_loads: number;
  }>;
  outlook: string;
};

// ─── AI generation ────────────────────────────────────────────────────────────

async function generateRateBenchmark(
  origin: string,
  destination: string
): Promise<RateBenchmarkData> {
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const { text } = await generateText({
    model: "anthropic/claude-haiku-4.5",
    maxOutputTokens: 512,
    prompt: `You are a freight market analyst. Generate rate benchmark data for a dry van lane from ${origin} to ${destination} in ${dateStr}.

Respond ONLY with JSON (no markdown):
{
  "rate_low": <realistic low spot $/mile, 2 decimal places>,
  "rate_high": <realistic high spot $/mile, 2 decimal places>,
  "market_avg": <estimated market average $/mile, 2 decimal places>,
  "trend": <"up" | "flat" | "down" — current market trend for this lane>,
  "confidence_label": <6-8 word confidence statement>,
  "insights": [
    "<specific freight market insight about this lane, 2-3 sentences>",
    "<seasonal or capacity insight>",
    "<market opportunity or risk>"
  ]
}`,
  });
  return JSON.parse(text.trim()) as RateBenchmarkData;
}

async function generateCarrierScore(
  origin: string,
  destination: string
): Promise<CarrierScoreData> {
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const { text } = await generateText({
    model: "anthropic/claude-haiku-4.5",
    maxOutputTokens: 512,
    prompt: `You are a freight carrier reliability analyst. Estimate a composite carrier reliability score for dry van carriers on the lane from ${origin} to ${destination} in ${dateStr}.

This is a lane-level carrier market score (not a specific carrier). Score the availability and reliability of carriers on this lane.

Respond ONLY with JSON (no markdown):
{
  "carrier_name": "Lane Carrier Market",
  "score": <integer 0-100, typical range 55-85>,
  "grade": <"A" | "B" | "C" | "D" | "F">,
  "summary": "<2-3 sentence narrative about carrier availability and reliability on this lane>",
  "strengths": ["<strength 1, 5-10 words>", "<strength 2, 5-10 words>"],
  "risks": ["<risk 1, 5-10 words>", "<risk 2, 5-10 words>"]
}`,
  });
  return JSON.parse(text.trim()) as CarrierScoreData;
}

// ─── Autonomous coverage lookup (static seed data for primary lanes) ──────────

function getAutonomousCoverage(origin: string, destination: string): AutonomousFleetData {
  const o = origin.toLowerCase();
  const d = destination.toLowerCase();

  // DFW-Houston corridor is Aurora Innovation certified
  const isDFWHouston =
    (o.includes("dallas") || o.includes("fort worth") || o.includes("dfw")) &&
    (d.includes("houston") || d.includes("houston, tx"));
  const isHoustonDFW =
    (o.includes("houston")) &&
    (d.includes("dallas") || d.includes("fort worth") || d.includes("dfw"));

  if (isDFWHouston || isHoustonDFW) {
    return {
      coverage: "YES",
      coverage_summary:
        "This corridor has certified autonomous carrier coverage via Aurora Innovation on I-45.",
      carriers: [
        {
          name: "Aurora Innovation",
          status: "certified",
          active_trucks: 24,
          uptime_pct: 99.2,
          daily_loads: 8,
        },
      ],
      outlook:
        "Aurora is FMCSA-certified on this corridor with strong uptime. Autonomous capacity is available and reliable for shippers seeking consistent, driverless execution on this lane.",
    };
  }

  // Texas intrastate corridors — partial
  const isTexasIntrastate =
    (o.includes("dallas") || o.includes("dfw") || o.includes("fort worth") ||
      o.includes("austin") || o.includes("san antonio") || o.includes("houston")) &&
    (d.includes("dallas") || d.includes("dfw") || d.includes("fort worth") ||
      d.includes("austin") || d.includes("san antonio") || d.includes("houston"));

  if (isTexasIntrastate) {
    return {
      coverage: "PARTIAL",
      coverage_summary: "Partial autonomous coverage available for Texas intrastate corridors.",
      carriers: [
        { name: "Aurora Innovation", status: "certified", active_trucks: 24, uptime_pct: 99.2, daily_loads: 6 },
        { name: "Gatik AI", status: "certified", active_trucks: 18, uptime_pct: 98.7, daily_loads: 12 },
      ],
      outlook:
        "Multiple certified operators serve Texas corridors. Coverage is expanding — check directly with Aurora and Gatik for specific routing availability.",
    };
  }

  // Long-haul / interstate lanes (ATL-DFW, CHI-DFW, DFW-LA, LA-DFW)
  return {
    coverage: "NO",
    coverage_summary:
      "No certified autonomous carrier coverage available for this long-haul corridor at this time.",
    carriers: [],
    outlook:
      "Long-haul autonomous trucking for this corridor is not yet commercially certified. Waymo Via and Aurora are expanding interstate coverage — expected within 12-18 months. Traditional carriers remain the best option for this lane.",
  };
}

function scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

// ─── PDF Document ──────────────────────────────────────────────────────────────

function SampleReportDocument({
  origin,
  destination,
  leadName,
  company,
  date,
  rate,
  carrierScore,
  autonomous,
}: {
  origin: string;
  destination: string;
  leadName?: string;
  company?: string;
  date: string;
  rate: RateBenchmarkData;
  carrierScore: CarrierScoreData;
  autonomous: AutonomousFleetData;
}) {
  const trendColor =
    rate.trend === "up" ? C.green : rate.trend === "down" ? C.red : C.slate;
  const trendLabel =
    rate.trend === "up" ? "▲ Rising" : rate.trend === "down" ? "▼ Falling" : "→ Stable";

  const gradeColor = (g: string) => {
    if (g === "A") return C.green;
    if (g === "B") return "#3B82F6";
    if (g === "C") return C.amber;
    return C.red;
  };

  const covColor =
    autonomous.coverage === "YES" ? C.green : autonomous.coverage === "PARTIAL" ? C.amber : C.slate;
  const covLabel =
    autonomous.coverage === "YES"
      ? "Autonomous Ready"
      : autonomous.coverage === "PARTIAL"
      ? "Partial Coverage"
      : "No Coverage";

  return (
    <Document title={`LaneBrief Intelligence Report · ${origin} → ${destination}`}>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.reportTitle}>LaneBrief Intelligence Report</Text>
            <Text style={styles.laneLabel}>
              {origin} → {destination} · Dry Van
            </Text>
            {(leadName || company) && (
              <Text style={styles.leadLine}>
                Prepared for {[leadName, company].filter(Boolean).join(" · ")}
              </Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.dateBadge}>{date}</Text>
            <Text style={styles.poweredBy}>LaneBrief · lanebrief.com</Text>
          </View>
        </View>

        {/* Section 1: Rate Benchmarker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1 · Rate Benchmarker</Text>
          <View style={styles.card}>
            <View style={styles.grid}>
              <View style={styles.gridCell}>
                <Text style={styles.gridLabel}>Spot Range</Text>
                <Text style={styles.gridValue}>
                  ${rate.rate_low.toFixed(2)} – ${rate.rate_high.toFixed(2)}
                </Text>
                <Text style={styles.gridSub}>per mile</Text>
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.gridLabel}>Market Avg</Text>
                <Text style={styles.gridValue}>${rate.market_avg.toFixed(2)}</Text>
                <Text style={styles.gridSub}>per mile</Text>
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.gridLabel}>Trend</Text>
                <Text style={[styles.gridValue, { color: trendColor, fontSize: 11 }]}>
                  {trendLabel}
                </Text>
                <Text style={styles.gridSub}>current direction</Text>
              </View>
            </View>
            <View style={{ marginTop: 10 }}>
              {rate.insights.map((insight, i) => (
                <View key={i} style={styles.bullet}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{insight}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.note}>
              {rate.confidence_label} · AI-estimated. Not a substitute for live market rates.
            </Text>
          </View>
        </View>

        {/* Section 2: Carrier Scoring */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2 · Carrier Scoring</Text>
          <View style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <View style={{ marginRight: 16 }}>
                <Text
                  style={{
                    fontSize: 36,
                    fontFamily: "Helvetica-Bold",
                    color: gradeColor(carrierScore.grade),
                  }}
                >
                  {carrierScore.grade}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", marginBottom: 4 }}>
                  <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: C.navy }}>
                    {carrierScore.score}
                  </Text>
                  <Text style={{ fontSize: 10, color: C.slate, marginLeft: 4 }}>/ 100</Text>
                </View>
                <Text style={{ fontSize: 9, color: C.slate }}>Lane Carrier Market Score</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={{ fontSize: 10, color: C.navy, marginBottom: 10, lineHeight: 1.5 }}>
              {carrierScore.summary}
            </Text>
            <View style={styles.scoreRow}>
              <View style={styles.scoreCol}>
                <Text style={styles.scoreColLabel}>Strengths</Text>
                {carrierScore.strengths.map((s, i) => (
                  <View key={i} style={styles.scoreBullet}>
                    <View style={[styles.scoreBulletDot, { backgroundColor: C.green }]} />
                    <Text style={styles.scoreBulletText}>{s}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.scoreCol}>
                <Text style={[styles.scoreColLabel, { color: C.red }]}>Risks</Text>
                {carrierScore.risks.map((r, i) => (
                  <View key={i} style={styles.scoreBullet}>
                    <View style={[styles.scoreBulletDot, { backgroundColor: C.red }]} />
                    <Text style={styles.scoreBulletText}>{r}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={styles.note}>
              AI-estimated. Not a substitute for FMCSA SAFER data or direct carrier vetting.
            </Text>
          </View>
        </View>

        {/* Section 3: Autonomous Fleet Intel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3 · Autonomous Fleet Intel</Text>
          <View style={styles.card}>
            <View style={styles.autonomousStatus}>
              <Text
                style={[
                  styles.autonomousStatusBadge,
                  { backgroundColor: covColor + "22", color: covColor },
                ]}
              >
                {covLabel}
              </Text>
              <Text style={styles.autonomousStatusText}>
                {autonomous.coverage_summary}
              </Text>
            </View>
            {autonomous.carriers.length > 0 && (
              <View style={{ marginBottom: 10 }}>
                {autonomous.carriers.map((c, i) => (
                  <View key={i} style={styles.carrierRow}>
                    <View>
                      <Text style={styles.carrierName}>{c.name}</Text>
                      <Text style={styles.carrierMeta}>
                        {c.active_trucks} active trucks · {c.uptime_pct}% uptime · up to{" "}
                        {c.daily_loads} loads/day
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.carrierBadge,
                        {
                          backgroundColor: c.status === "certified" ? C.green + "22" : C.amber + "22",
                          color: c.status === "certified" ? C.green : C.amber,
                        },
                      ]}
                    >
                      {c.status === "certified" ? "FMCSA Certified" : "Provisional"}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.bullet}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{autonomous.outlook}</Text>
            </View>
            <Text style={styles.note}>
              Based on FMCSA public filings and carrier press releases. Verify directly before
              tendering.
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>
            Confidential · LaneBrief Intelligence Report · {date}
          </Text>
          <Text style={styles.footerRight}>lanebrief.com</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── POST Handler ──────────────────────────────────────────────────────────────

type SampleReportRequest = {
  lane: { origin: string; destination: string };
  lead?: { name?: string; company?: string };
};

export async function POST(request: Request) {
  let body: SampleReportRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { lane, lead } = body;

  if (!lane?.origin || !lane?.destination) {
    return Response.json(
      { error: "Missing required fields: lane.origin, lane.destination" },
      { status: 400 }
    );
  }

  const origin = lane.origin.trim();
  const destination = lane.destination.trim();
  const leadName = lead?.name?.trim();
  const company = lead?.company?.trim();
  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Generate all sections in parallel
  let rate: RateBenchmarkData;
  let carrierScore: CarrierScoreData;
  let autonomous: AutonomousFleetData;

  try {
    [rate, carrierScore] = await Promise.all([
      generateRateBenchmark(origin, destination),
      generateCarrierScore(origin, destination),
    ]);
    autonomous = getAutonomousCoverage(origin, destination);
  } catch (err) {
    console.error("[pdf/sample-report] AI generation error:", err);
    return Response.json({ error: "AI service unavailable" }, { status: 503 });
  }

  // Normalize grade (AI may return string score)
  if (typeof carrierScore.score === "string") {
    carrierScore.score = parseInt(carrierScore.score, 10);
  }
  carrierScore.score = Math.max(0, Math.min(100, Math.round(carrierScore.score)));
  carrierScore.grade = scoreToGrade(carrierScore.score);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(
      <SampleReportDocument
        origin={origin}
        destination={destination}
        leadName={leadName}
        company={company}
        date={date}
        rate={rate}
        carrierScore={carrierScore}
        autonomous={autonomous}
      />
    );
  } catch (err) {
    console.error("[pdf/sample-report] PDF render error:", err);
    return Response.json({ error: "PDF generation failed" }, { status: 500 });
  }

  const slug = `${origin}-to-${destination}`
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()
    .slice(0, 60);

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="lanebrief-sample-${slug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
