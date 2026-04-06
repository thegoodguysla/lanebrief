import { generateText } from "ai";
import { Resend } from "resend";
import { buildIntelligenceReportHtml } from "@/app/api/cron/weekly-intelligence-report/route";
import type { LaneBrief } from "@/app/api/cron/weekly-intelligence-report/route";

const MX_HIGH_RISK = ["nuevo laredo", "laredo", "ciudad juarez", "ciudad juárez", "juarez", "juárez", "el paso", "reynosa", "pharr", "mcallen", "piedras negras", "eagle pass", "ciudad acuna", "ciudad acuña", "del rio", "nogales", "otay mesa", "tijuana"];
const CA_HIGH_RISK = ["detroit", "windsor", "port huron", "sarnia"];
const MX_MEDIUM_RISK = ["calexico", "mexicali"];
const CA_MEDIUM_RISK = ["buffalo", "fort erie", "blaine", "surrey", "pembina", "emerson", "sweetgrass", "coutts"];
const MX_GENERAL = ["mexico", " mx", ",mx", "monterrey", "guadalajara", "cdmx", "mexico city", "matamoros", "saltillo", "hermosillo", "chihuahua", "torreon"];
const CA_GENERAL = ["canada", "ontario", "quebec", "british columbia", "alberta", "manitoba", "saskatchewan", "nova scotia", "new brunswick", "prince edward island", "newfoundland", " on,", " qc,", " ab,", " mb,", " sk,", " ns,", " nb,", " pe,", " nl,", "toronto", "montreal", "vancouver", "calgary", "edmonton", "ottawa", "winnipeg", "halifax", "hamilton", "london, on", "kitchener"];

function getTariffFlag(origin: string, destination: string): LaneBrief["tariffFlag"] {
  const text = `${origin} ${destination}`.toLowerCase();
  if (MX_HIGH_RISK.some((kw) => text.includes(kw))) return "MX-high";
  if (CA_HIGH_RISK.some((kw) => text.includes(kw))) return "CA-high";
  if (MX_MEDIUM_RISK.some((kw) => text.includes(kw))) return "MX-medium";
  if (CA_MEDIUM_RISK.some((kw) => text.includes(kw))) return "CA-medium";
  if (MX_GENERAL.some((kw) => text.includes(kw))) return "MX-medium";
  if (CA_GENERAL.some((kw) => text.includes(kw))) return "CA-medium";
  return null;
}

async function getLaneIntelligence(origin: string, destination: string, equipment: string) {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();

  const { text } = await generateText({
    model: "anthropic/claude-haiku-4.5",
    prompt: `You are a freight market analyst. For a ${equipment.replace(/_/g, " ")} load from ${origin} to ${destination} in ${month} ${year}, provide:

Respond with ONLY a JSON object (no markdown):
{
  "rate_usd_per_mile": <number, 2 decimal places, current spot market avg>,
  "carrier_recommendation": "<carrier type or network recommendation, 10 words max, specific and actionable>",
  "ai_summary": "<one sentence, max 20 words, key market condition for this lane this week>",
  "capacity_signal": "<tight|moderate|loose>",
  "tender_acceptance_pct": <integer 0-100>
}

Rules:
- rate_usd_per_mile: realistic spot rate for this lane, equipment, and season
- carrier_recommendation: specific actionable tip
- ai_summary: laser-focused on the #1 condition affecting this lane right now
- capacity_signal: current truck availability
- tender_acceptance_pct: estimated % of tenders accepted`,
    maxOutputTokens: 300,
  });

  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  const parsed = JSON.parse(cleaned) as {
    rate_usd_per_mile: number;
    carrier_recommendation: string;
    ai_summary: string;
    capacity_signal: "tight" | "moderate" | "loose";
    tender_acceptance_pct: number;
  };

  return {
    rateUsdPerMile: parsed.rate_usd_per_mile,
    carrierRecommendation: parsed.carrier_recommendation,
    aiSummary: parsed.ai_summary,
    capacitySignal: parsed.capacity_signal as LaneBrief["capacitySignal"],
    tenderAcceptancePct: parsed.tender_acceptance_pct,
  };
}

function buildSampleReportEmail(briefLanes: LaneBrief[]): string {
  const reportHtml = buildIntelligenceReportHtml(briefLanes, false);
  const weekOf = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
  <p style="margin: 0 0 16px 0; color: #0D1F3C;">Here's your free freight intelligence report for the lanes you submitted. This is the same format our paid subscribers receive every Monday morning.</p>
  <p style="margin: 0 0 20px 0; font-size: 13px; color: #6B7B8D;">Week of ${weekOf}</p>

  ${reportHtml}

  <div style="margin-top: 24px; padding: 20px 24px; background: #F0FDFA; border-radius: 8px; border: 1px solid #B2F5EA;">
    <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #0D1F3C;">This is a free sample report.</p>
    <p style="margin: 0 0 16px 0; font-size: 13px; color: #4A5568;">Sign up for LaneBrief to get this every Monday plus real-time alerts, forecasts, and carrier intelligence for all your active lanes.</p>
    <a href="https://lanebrief.com/sign-up" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 10px 24px; border-radius: 6px;">
      Start free trial →
    </a>
  </div>

  <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #E2E8F0;">
    <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #0D1F3C;">LaneBrief Intelligence</p>
    <p style="margin: 0; font-size: 11px; color: #6B7B8D;">
      <a href="mailto:intel@lanebrief.com" style="color: #0D1F3C; text-decoration: none;">intel@lanebrief.com</a>
      &nbsp;·&nbsp;
      <a href="https://lanebrief.com" style="color: #00C2A8; text-decoration: none;">lanebrief.com</a>
    </p>
  </div>
</div>`;
}

export async function POST(req: Request) {
  let body: { email: string; lane1: string; lane2?: string; lane3?: string; equipment?: string };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, lane1, lane2, lane3, equipment = "dry_van" } = body;

  if (!email || !lane1) {
    return Response.json({ error: "email and lane1 are required" }, { status: 400 });
  }

  const laneInputs = [lane1, lane2, lane3].filter((l): l is string => Boolean(l));

  // Parse "Origin → Destination" or "Origin > Destination" or "Origin - Destination"
  const parsedLanes: { origin: string; destination: string }[] = [];
  for (const lane of laneInputs) {
    const parts = lane.split(/\s*[→>]\s*|\s+-+\s+/);
    if (parts.length >= 2) {
      parsedLanes.push({ origin: parts[0].trim(), destination: parts[1].trim() });
    }
  }

  if (parsedLanes.length === 0) {
    return Response.json({ error: "Could not parse lane. Use format: Chicago, IL → Dallas, TX" }, { status: 400 });
  }

  console.log(`[sample-report-lead] email=${email} lanes=${laneInputs.join(" | ")} equipment=${equipment}`);

  // Generate AI intelligence for each lane in parallel
  const results = await Promise.allSettled(
    parsedLanes.map(({ origin, destination }) => getLaneIntelligence(origin, destination, equipment))
  );

  const briefLanes: LaneBrief[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const lane = parsedLanes[i];
    if (result.status === "fulfilled") {
      const intel = result.value;
      briefLanes.push({
        origin: lane.origin,
        destination: lane.destination,
        equipment,
        rateSummary: `$${intel.rateUsdPerMile.toFixed(2)}/mi`,
        rateUsdPerMile: intel.rateUsdPerMile,
        deltaPct: null,
        capacitySignal: intel.capacitySignal,
        tenderRisk: intel.tenderAcceptancePct < 60 ? "high" : intel.tenderAcceptancePct < 75 ? "medium" : "low",
        tenderAcceptancePct: intel.tenderAcceptancePct,
        tariffFlag: getTariffFlag(lane.origin, lane.destination),
        carrierRecommendation: intel.carrierRecommendation,
        aiSummary: intel.aiSummary,
      });
    } else {
      console.error(`[sample-report] Intel failed for ${lane.origin}→${lane.destination}:`, result.reason);
    }
  }

  if (briefLanes.length === 0) {
    return Response.json({ error: "Failed to generate report intelligence" }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const weekOf = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

  try {
    await resend.emails.send({
      from: "LaneBrief Intel <intel@email.lanebrief.com>",
      replyTo: "nick@lanebrief.com",
      to: email,
      subject: `📊 Your Free LaneBrief Intelligence Report — ${weekOf}`,
      html: buildSampleReportEmail(briefLanes),
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[sample-report] Email send failed:", err);
    return Response.json({ error: "Failed to send report email" }, { status: 500 });
  }
}
