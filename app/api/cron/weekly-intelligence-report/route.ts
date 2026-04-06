import { getDb } from "@/lib/db";
import { users, lanes, rateSnapshots, tenderAcceptanceCache, capacityHeatmapCache } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { generateText } from "ai";
import { Resend } from "resend";
import { randomUUID } from "crypto";

// Vercel Cron: every Monday 7am ET (12:00 UTC)
// vercel.json schedule: "0 12 * * 1"

const FROM = "LaneBrief Intel <intel@email.lanebrief.com>";

export type LaneBrief = {
  origin: string;
  destination: string;
  equipment: string;
  rateSummary: string;
  rateUsdPerMile: number;
  deltaPct: number | null;
  capacitySignal: "tight" | "moderate" | "loose" | null;
  tenderRisk: "low" | "medium" | "high" | null;
  tenderAcceptancePct: number | null;
  tariffFlag: "MX-high" | "MX-medium" | "CA-high" | "CA-medium" | null;
  carrierRecommendation: string;
  aiSummary: string;
};

// ---- Tariff detection (mirrors dashboard logic) ----
const MX_HIGH_RISK = ["nuevo laredo", "laredo", "ciudad juarez", "ciudad juárez", "juarez", "juárez", "el paso", "reynosa", "pharr", "mcallen", "piedras negras", "eagle pass", "ciudad acuna", "ciudad acuña", "del rio", "nogales", "otay mesa", "tijuana"];
const MX_MEDIUM_RISK = ["calexico", "mexicali"];
const MX_GENERAL = ["mexico", " mx", ",mx", "monterrey", "guadalajara", "cdmx", "mexico city", "matamoros", "saltillo", "hermosillo", "chihuahua", "torreon"];
const CA_HIGH_RISK = ["detroit", "windsor", "port huron", "sarnia"];
const CA_MEDIUM_RISK = ["buffalo", "fort erie", "blaine", "surrey", "pembina", "emerson", "sweetgrass", "coutts"];
const CA_GENERAL = ["canada", "ontario", "quebec", "british columbia", "alberta", "manitoba", "saskatchewan", "nova scotia", "new brunswick", "prince edward island", "newfoundland", " on,", " qc,", " ab,", " mb,", " sk,", " ns,", " nb,", " pe,", " nl,", "toronto", "montreal", "vancouver", "calgary", "edmonton", "ottawa", "winnipeg", "halifax", "hamilton", "london, on", "kitchener"];

function getTariffFlag(origin: string, destination: string, equipment: string): LaneBrief["tariffFlag"] {
  const text = `${origin} ${destination}`.toLowerCase();
  if (MX_HIGH_RISK.some((kw) => text.includes(kw))) return "MX-high";
  if (CA_HIGH_RISK.some((kw) => text.includes(kw))) return "CA-high";
  if (MX_MEDIUM_RISK.some((kw) => text.includes(kw))) return "MX-medium";
  if (CA_MEDIUM_RISK.some((kw) => text.includes(kw))) return "CA-medium";
  if (MX_GENERAL.some((kw) => text.includes(kw))) return "MX-medium";
  if (CA_GENERAL.some((kw) => text.includes(kw))) return "CA-medium";
  if (equipment === "flatbed" && CA_GENERAL.some((kw) => text.includes(kw))) return "CA-high";
  return null;
}

// ---- AI helpers ----
async function getLaneIntelligence(
  origin: string,
  destination: string,
  equipment: string
): Promise<{ rateUsdPerMile: number; carrierRecommendation: string; aiSummary: string }> {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();

  const { text } = await generateText({
    model: "anthropic/claude-haiku-4.5",
    prompt: `You are a freight market analyst. For a ${equipment.replace("_", " ")} load from ${origin} to ${destination} in ${month} ${year}, provide:

Respond with ONLY a JSON object (no markdown):
{
  "rate_usd_per_mile": <number, 2 decimal places, current spot market avg>,
  "carrier_recommendation": "<carrier type or network recommendation, 10 words max, specific and actionable>",
  "ai_summary": "<one sentence, max 20 words, key market condition for this lane this week>"
}

Rules:
- rate_usd_per_mile: realistic spot rate for this lane, equipment, and season
- carrier_recommendation: specific actionable tip (e.g. "Regional flatbed carriers outperform nationals here", "Use reefer-heavy Southeast network for faster tendering")
- ai_summary: laser-focused on the #1 condition affecting this lane right now`,
    maxOutputTokens: 256,
  });

  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const parsed = JSON.parse(cleaned) as {
    rate_usd_per_mile: number;
    carrier_recommendation: string;
    ai_summary: string;
  };

  return {
    rateUsdPerMile: parsed.rate_usd_per_mile,
    carrierRecommendation: parsed.carrier_recommendation,
    aiSummary: parsed.ai_summary,
  };
}

// ---- Email builder ----
export function buildIntelligenceReportHtml(lanes: LaneBrief[], previewMode = false): string {
  const weekOf = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const laneRows = lanes.map((l) => {
    const eq = l.equipment.replace("_", " ");
    const deltaLabel = l.deltaPct === null
      ? '<span style="color: #6B7B8D; font-size: 11px;">Baseline set</span>'
      : `<span style="color: ${l.deltaPct >= 0 ? "#DC2626" : "#16A34A"}; font-weight: bold; font-size: 13px;">${l.deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(l.deltaPct).toFixed(1)}%</span>`;

    const riskBadge = l.tenderRisk === "high"
      ? `<span style="background: #FEF2F2; color: #DC2626; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">⚠ ${l.tenderAcceptancePct}% accept</span>`
      : l.tenderRisk === "medium"
      ? `<span style="background: #FFF7ED; color: #EA580C; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">◑ ${l.tenderAcceptancePct}% accept</span>`
      : l.tenderAcceptancePct !== null
      ? `<span style="background: #F0FDF4; color: #16A34A; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">✓ ${l.tenderAcceptancePct}% accept</span>`
      : "";

    const capacityBadge = l.capacitySignal === "tight"
      ? `<span style="background: #FEF2F2; color: #DC2626; padding: 2px 6px; border-radius: 4px; font-size: 11px;">🔴 Tight capacity</span>`
      : l.capacitySignal === "moderate"
      ? `<span style="background: #FFFBEB; color: #D97706; padding: 2px 6px; border-radius: 4px; font-size: 11px;">🟡 Moderate capacity</span>`
      : l.capacitySignal === "loose"
      ? `<span style="background: #F0FDF4; color: #16A34A; padding: 2px 6px; border-radius: 4px; font-size: 11px;">🟢 Loose capacity</span>`
      : "";

    const tariffBadge = l.tariffFlag
      ? `<span style="background: #FFF5F5; color: #E53E3E; padding: 2px 6px; border-radius: 4px; font-size: 11px;">⚠ ${l.tariffFlag.replace("-", " ")} tariff</span>`
      : "";

    return `
<div style="padding: 20px; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 16px; background: #FAFCFF;">
  <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
    <tr>
      <td style="vertical-align: top;">
        <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: bold; color: #0D1F3C;">${l.origin} → ${l.destination}</p>
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7B8D; text-transform: capitalize;">${eq}</p>
        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px;">
          ${riskBadge} ${capacityBadge} ${tariffBadge}
        </div>
      </td>
      <td style="text-align: right; vertical-align: top; white-space: nowrap;">
        <p style="margin: 0 0 2px 0; font-size: 20px; font-weight: bold; color: #0D1F3C;">$${l.rateUsdPerMile.toFixed(2)}<span style="font-size: 12px; color: #6B7B8D;">/mi</span></p>
        ${deltaLabel}
      </td>
    </tr>
  </table>
  <div style="padding: 10px 12px; background: #F0FDF9; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #00C2A8;">
    <p style="margin: 0; font-size: 13px; color: #0D1F3C; font-style: italic;">💡 ${l.aiSummary}</p>
  </div>
  <div style="padding: 8px 12px; background: #F7F9FC; border-radius: 6px; border-left: 3px solid #6366F1;">
    <p style="margin: 0; font-size: 12px; color: #4A5568;"><strong style="color: #0D1F3C;">Top carrier:</strong> ${l.carrierRecommendation}</p>
  </div>
</div>`;
  }).join("");

  const previewBanner = previewMode ? `
<div style="background: #FEF3C7; padding: 12px 20px; border-radius: 6px; margin-bottom: 20px; text-align: center;">
  <p style="margin: 0; font-size: 13px; color: #92400E; font-weight: bold;">📋 Sample Report — Sign in to get your personalized weekly brief</p>
  <a href="https://lanebrief.com/sign-up" style="color: #92400E; font-size: 12px;">Get your free weekly report →</a>
</div>` : "";

  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
  <div style="background: linear-gradient(135deg, #0D1F3C 0%, #1a3a5c 100%); padding: 28px 32px; border-radius: 8px 8px 0 0;">
    <p style="margin: 0 0 4px 0; font-size: 22px; font-weight: bold; color: #FFFFFF;">
      <span style="color: #00C2A8;">▶</span> LaneBrief Intelligence Report
    </p>
    <p style="margin: 0; font-size: 13px; color: #A0AEC0;">Week of ${weekOf} — Your personalized freight market brief</p>
  </div>

  <div style="padding: 28px 0 0 0; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 8px 8px;">
    <div style="padding: 0 24px 20px;">
      ${previewBanner}
      <p style="margin: 0 0 20px 0; font-size: 12px; font-weight: bold; color: #6B7B8D; text-transform: uppercase; letter-spacing: 0.05em;">
        Your Lane Intelligence (${lanes.length} lane${lanes.length !== 1 ? "s" : ""})
      </p>
      ${laneRows}
    </div>

    <div style="padding: 16px 24px; background: #F0FDFA; border-top: 1px solid #E2F5F2;">
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
        <tr>
          <td>
            <p style="margin: 0; font-size: 12px; color: #4A5568;">
              <strong>Rate methodology:</strong> AI-estimated from market patterns. Not a substitute for live broker data.
            </p>
          </td>
          <td style="text-align: right;">
            <a href="https://lanebrief.com/dashboard" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 13px; font-weight: bold; text-decoration: none; padding: 8px 20px; border-radius: 6px; white-space: nowrap;">
              Open Dashboard →
            </a>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding: 16px 24px; border-top: 1px solid #E2F5F2;">
      <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #0D1F3C;">LaneBrief Intelligence</p>
      <p style="margin: 0; font-size: 11px; color: #6B7B8D;">
        <a href="mailto:intel@lanebrief.com" style="color: #0D1F3C; text-decoration: none;">intel@lanebrief.com</a>
        &nbsp;·&nbsp;
        <a href="https://lanebrief.com" style="color: #00C2A8; text-decoration: none;">lanebrief.com</a>
        &nbsp;·&nbsp;
        <a href="https://lanebrief.com/dashboard" style="color: #A0AEC0; text-decoration: none;">Manage lanes</a>
      </p>
    </div>
  </div>
</div>`;
}

// ---- Shared send helper (used by cron + admin trigger) ----
export async function sendIntelligenceReportForUser(
  userId: string,
  email: string,
  db: ReturnType<typeof getDb>
): Promise<"sent" | "skipped" | "error"> {
  const userLanes = await db
    .select()
    .from(lanes)
    .where(eq(lanes.userId, userId));

  if (userLanes.length === 0) return "skipped";

  // Load cached signals (no await blocking — use whatever is fresh in cache)
  const laneIds = userLanes.map((l) => l.id);

  const [capacityRows, tenderRows, snapRows] = await Promise.all([
    db.select().from(capacityHeatmapCache).where(inArray(capacityHeatmapCache.laneId, laneIds)).orderBy(desc(capacityHeatmapCache.generatedAt)),
    db.select().from(tenderAcceptanceCache).where(inArray(tenderAcceptanceCache.laneId, laneIds)).orderBy(desc(tenderAcceptanceCache.generatedAt)),
    db.select().from(rateSnapshots).where(inArray(rateSnapshots.laneId, laneIds)).orderBy(desc(rateSnapshots.generatedAt)),
  ]);

  const capacityByLane = new Map(capacityRows.reduce<[string, typeof capacityRows[0]][]>((acc, r) => {
    if (!acc.find(([id]) => id === r.laneId)) acc.push([r.laneId, r]);
    return acc;
  }, []));
  const tenderByLane = new Map(tenderRows.reduce<[string, typeof tenderRows[0]][]>((acc, r) => {
    if (!acc.find(([id]) => id === r.laneId)) acc.push([r.laneId, r]);
    return acc;
  }, []));
  const snapByLane = new Map(snapRows.reduce<[string, typeof snapRows[0]][]>((acc, r) => {
    if (!acc.find(([id]) => id === r.laneId)) acc.push([r.laneId, r]);
    return acc;
  }, []));

  // Build per-lane briefs (top 5 lanes)
  const briefLanes: LaneBrief[] = [];
  for (const lane of userLanes.slice(0, 5)) {
    try {
      const intel = await getLaneIntelligence(lane.origin, lane.destination, lane.equipment);
      const lastSnap = snapByLane.get(lane.id);
      const deltaPct = lastSnap
        ? Math.round(((intel.rateUsdPerMile - lastSnap.marketAvgUsdPerMile) / lastSnap.marketAvgUsdPerMile) * 1000) / 10
        : null;

      const cap = capacityByLane.get(lane.id);
      const tender = tenderByLane.get(lane.id);

      briefLanes.push({
        origin: lane.origin,
        destination: lane.destination,
        equipment: lane.equipment,
        rateSummary: `$${intel.rateUsdPerMile.toFixed(2)}/mi`,
        rateUsdPerMile: intel.rateUsdPerMile,
        deltaPct,
        capacitySignal: cap ? (cap.capacityLevel as LaneBrief["capacitySignal"]) : null,
        tenderRisk: tender ? (tender.riskLevel as LaneBrief["tenderRisk"]) : null,
        tenderAcceptancePct: tender ? tender.estimatedAcceptancePct : null,
        tariffFlag: getTariffFlag(lane.origin, lane.destination, lane.equipment),
        carrierRecommendation: intel.carrierRecommendation,
        aiSummary: intel.aiSummary,
      });

      // Store rate snapshot for delta tracking next week
      await db.insert(rateSnapshots).values({
        id: randomUUID(),
        laneId: lane.id,
        origin: lane.origin,
        destination: lane.destination,
        equipment: lane.equipment,
        ratePerMile: intel.rateUsdPerMile,
        marketAvgUsdPerMile: intel.rateUsdPerMile,
        deltaPct: deltaPct ?? 0,
        verdict: deltaPct === null ? "baseline" : deltaPct > 3 ? "above_market" : deltaPct < -3 ? "below_market" : "at_market",
        disclaimer: "AI-estimated",
      });
    } catch (err) {
      console.error(`[laneBrief-report] Intel failed for ${lane.origin}→${lane.destination}:`, err);
    }
  }

  if (briefLanes.length === 0) return "skipped";

  const resend = new Resend(process.env.RESEND_API_KEY);
  const weekOf = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

  try {
    await resend.emails.send({
      from: FROM,
      replyTo: "intel@lanebrief.com",
      to: email,
      subject: `📊 Your LaneBrief Intelligence Report — Week of ${weekOf}`,
      html: buildIntelligenceReportHtml(briefLanes),
    });
    return "sent";
  } catch (err) {
    console.error(`[laneBrief-report] Email failed for ${email}:`, err);
    return "error";
  }
}

// ---- Cron handler ----
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = getDb();
  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of allUsers) {
    const result = await sendIntelligenceReportForUser(user.id, user.email, db);
    if (result === "sent") sent++;
    else if (result === "skipped") skipped++;
    else errors++;
  }

  console.log(`[laneBrief-report] Done. sent=${sent} skipped=${skipped} errors=${errors}`);
  return Response.json({ ok: true, sent, skipped, errors });
}
