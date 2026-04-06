import { getDb } from "@/lib/db";
import { users, lanes, rateSnapshots, tenderAcceptanceCache } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { generateText } from "ai";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import { detectUSMXCrossing, getPatternDelayResult, type BorderDelayResult } from "@/lib/border-delay";

// Vercel Cron: every Monday 8am ET (13:00 UTC)
// vercel.json schedule: "0 13 * * 1"

// USMCA Compliance Flag helpers (mirrors dashboard detection)
const CA_HIGH_RISK = ["detroit", "windsor", "port huron", "sarnia"];
const CA_MEDIUM_RISK = ["buffalo", "fort erie", "blaine", "surrey", "pembina", "emerson", "sweetgrass", "coutts"];
const CA_GENERAL = [
  "canada", "ontario", "quebec", "british columbia", "alberta", "manitoba",
  "saskatchewan", "nova scotia", "new brunswick", "prince edward island", "newfoundland",
  " on,", " qc,", " ab,", " mb,", " sk,", " ns,", " nb,", " pe,", " nl,",
  "toronto", "montreal", "vancouver", "calgary", "edmonton", "ottawa", "winnipeg",
  "halifax", "hamilton", "london, on", "kitchener",
];

function getUSMCAFlag(origin: string, destination: string, equipment: string): "high" | "medium" | null {
  const text = `${origin} ${destination}`.toLowerCase();
  const isCALane =
    CA_HIGH_RISK.some((kw) => text.includes(kw)) ||
    CA_MEDIUM_RISK.some((kw) => text.includes(kw)) ||
    CA_GENERAL.some((kw) => text.includes(kw));
  if (!isCALane) return null;
  return equipment === "flatbed" ? "high" : "medium";
}

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = "LaneBrief Intel <intel@email.lanebrief.com>";

type LaneWithUser = {
  laneId: string;
  origin: string;
  destination: string;
  equipment: string;
  alertThresholdPct: number;
  userId: string;
  userEmail: string;
};

type RateEstimate = {
  marketAvgUsdPerMile: number;
  insight: string;
};

async function getAIRateEstimate(
  origin: string,
  destination: string,
  equipment: string
): Promise<RateEstimate> {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();

  const { text } = await generateText({
    model: "anthropic/claude-haiku-4.5",
    prompt: `You are a freight market analyst. For a ${equipment} load from ${origin} to ${destination} in ${month} ${year}:

Respond with ONLY a JSON object (no markdown):
{
  "market_avg_usd_per_mile": <number, 2 decimal places>,
  "insight": <string, 1 sentence max 15 words describing the key market signal>
}`,
    maxOutputTokens: 128,
  });

  const parsed = JSON.parse(text.trim()) as {
    market_avg_usd_per_mile: number;
    insight: string;
  };

  return {
    marketAvgUsdPerMile: parsed.market_avg_usd_per_mile,
    insight: parsed.insight,
  };
}

type AtRiskLane = {
  origin: string;
  destination: string;
  equipment: string;
  estimatedAcceptancePct: number;
  riskLevel: "low" | "medium" | "high";
  reasoning: string;
};

type DelayOutlaneItem = {
  origin: string;
  destination: string;
  crossingPoint: string;
  riskLevel: "high" | "moderate" | "normal";
  waitMinutes: number | null;
  patternNote: string | null;
  tariffCategoryFlag: boolean;
};

function buildDigestEmailHtml(
  alerts: { origin: string; destination: string; equipment: string; oldRate: number | null; newRate: number; deltaPct: number | null; insight: string; usmcaRisk: "high" | "medium" | null }[],
  atRiskLanes: AtRiskLane[],
  delayOutlook: DelayOutlaneItem[],
): string {
  const usmcaFlagged = alerts.filter((a) => a.usmcaRisk !== null);
  const usmcaSection = usmcaFlagged.length > 0
    ? `
<div style="margin-top: 20px; padding: 16px 20px; background-color: #FFF5F5; border-radius: 8px; border-left: 3px solid #E53E3E;">
  <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: bold; color: #C53030;">
    ⚠ USMCA Compliance Alert — 35% Tariff Exposure
  </p>
  <p style="margin: 0 0 8px 0; font-size: 13px; color: #4A5568;">
    Canada's 35% tariff on non-USMCA goods is now in effect. The following lane${usmcaFlagged.length > 1 ? "s" : ""} may be affected:
  </p>
  <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #4A5568;">
    ${usmcaFlagged.map((a) => {
      const riskLabel = a.usmcaRisk === "high"
        ? "High risk — flatbed cargo (steel, aluminum, auto parts) faces strict USMCA rules of origin"
        : "Moderate risk — verify commodity eligibility for USMCA treatment";
      return `<li style="margin-bottom: 4px;"><strong>${a.origin} → ${a.destination}</strong> (${a.equipment.replace("_", " ")}): ${riskLabel}</li>`;
    }).join("")}
  </ul>
  <p style="margin: 10px 0 0 0; font-size: 12px; color: #718096;">
    Advise shippers to confirm USMCA certificate of origin. High-risk categories: auto parts, steel, aluminum, textiles.
    <a href="https://lanebrief.com/dashboard" style="color: #C53030;">View lanes →</a>
  </p>
</div>`
    : "";

  const alertRows = alerts
    .map((a) => {
      const arrowColor = (a.deltaPct ?? 0) >= 0 ? "#00C2A8" : "#E53E3E";
      const arrow = (a.deltaPct ?? 0) >= 0 ? "▲" : "▼";
      const deltaLabel =
        a.deltaPct === null
          ? "First snapshot — baseline set"
          : `${arrow} ${Math.abs(a.deltaPct).toFixed(1)}% vs last week`;
      const eq = a.equipment.replace("_", " ");

      return `
<tr>
  <td style="padding: 12px 16px; border-bottom: 1px solid #E2F5F2;">
    <strong style="color: #0D1F3C; font-size: 14px;">${a.origin} → ${a.destination}</strong><br/>
    <span style="font-size: 12px; color: #6B7B8D; text-transform: capitalize;">${eq}</span>
  </td>
  <td style="padding: 12px 16px; border-bottom: 1px solid #E2F5F2; text-align: right;">
    <span style="font-size: 16px; font-weight: bold; color: #0D1F3C;">$${a.newRate.toFixed(2)}/mi</span><br/>
    <span style="font-size: 12px; color: ${arrowColor}; font-weight: bold;">${deltaLabel}</span>
  </td>
</tr>
<tr>
  <td colspan="2" style="padding: 4px 16px 12px 16px; border-bottom: 1px solid #E8EDF2;">
    <span style="font-size: 13px; color: #4A5568; font-style: italic;">💡 ${a.insight}</span>
  </td>
</tr>`;
    })
    .join("");

  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
  <div style="background: linear-gradient(135deg, #0D1F3C 0%, #1a3a5c 100%); padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #FFFFFF;">
      <span style="color: #00C2A8;">▶</span> LaneBrief Weekly Rate Alert
    </p>
    <p style="margin: 4px 0 0 0; font-size: 13px; color: #A0AEC0;">Rate movements on your saved lanes this week</p>
  </div>

  <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; border: 1px solid #E2F5F2; border-top: none; border-radius: 0 0 8px 8px; overflow: hidden;">
    <thead>
      <tr style="background-color: #F0FDFA;">
        <th style="padding: 10px 16px; text-align: left; font-size: 12px; font-weight: bold; color: #6B7B8D; text-transform: uppercase; letter-spacing: 0.05em;">Lane</th>
        <th style="padding: 10px 16px; text-align: right; font-size: 12px; font-weight: bold; color: #6B7B8D; text-transform: uppercase; letter-spacing: 0.05em;">Market Rate</th>
      </tr>
    </thead>
    <tbody>
      ${alertRows}
    </tbody>
  </table>

  ${usmcaSection}

  <div style="margin-top: 20px; padding: 16px 20px; background-color: #F7FAFC; border-radius: 8px; border-left: 3px solid #00C2A8;">
    <p style="margin: 0; font-size: 13px; color: #4A5568;">
      <strong>Note:</strong> All rates are AI-estimated based on general market knowledge and seasonal patterns. Not a substitute for live market data.
    </p>
  </div>

  ${atRiskLanes.length > 0 ? `
  <div style="margin-top: 24px;">
    <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: bold; color: #6B7B8D; text-transform: uppercase; letter-spacing: 0.05em;">
      ⚠ Tender Risk — Lowest Acceptance Lanes
    </p>
    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; border: 1px solid #FED7AA; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background-color: #FFF7ED;">
          <th style="padding: 8px 14px; text-align: left; font-size: 11px; font-weight: bold; color: #9A3412; text-transform: uppercase;">Lane</th>
          <th style="padding: 8px 14px; text-align: right; font-size: 11px; font-weight: bold; color: #9A3412; text-transform: uppercase;">Est. Acceptance</th>
        </tr>
      </thead>
      <tbody>
        ${atRiskLanes.map((l) => {
          const riskColor = l.riskLevel === "high" ? "#DC2626" : "#EA580C";
          const eq = l.equipment.replace("_", " ");
          return `
        <tr>
          <td style="padding: 10px 14px; border-top: 1px solid #FED7AA;">
            <strong style="color: #0D1F3C; font-size: 13px;">${l.origin} → ${l.destination}</strong><br/>
            <span style="font-size: 11px; color: #6B7B8D; text-transform: capitalize;">${eq}</span><br/>
            <span style="font-size: 11px; color: #4A5568; font-style: italic;">${l.reasoning}</span>
          </td>
          <td style="padding: 10px 14px; border-top: 1px solid #FED7AA; text-align: right; vertical-align: top;">
            <span style="font-size: 15px; font-weight: bold; color: ${riskColor};">${l.estimatedAcceptancePct}%</span><br/>
            <span style="font-size: 11px; color: ${riskColor}; text-transform: uppercase;">${l.riskLevel} risk</span>
          </td>
        </tr>`;
        }).join("")}
      </tbody>
    </table>
    <p style="margin: 6px 0 0 0; font-size: 11px; color: #A0AEC0;">Lock in carrier rates proactively on at-risk lanes to avoid tender rejection delays.</p>
  </div>` : ""}

  ${delayOutlook.filter((d) => d.riskLevel !== "normal").length > 0 ? `
  <div style="margin-top: 24px;">
    <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: bold; color: #6B7B8D; text-transform: uppercase; letter-spacing: 0.05em;">
      🚧 US-MX Crossing Delay Outlook
    </p>
    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; border: 1px solid #FEE2E2; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background-color: #FFF5F5;">
          <th style="padding: 8px 14px; text-align: left; font-size: 11px; font-weight: bold; color: #991B1B; text-transform: uppercase;">Lane / Crossing</th>
          <th style="padding: 8px 14px; text-align: right; font-size: 11px; font-weight: bold; color: #991B1B; text-transform: uppercase;">Delay Risk</th>
        </tr>
      </thead>
      <tbody>
        ${delayOutlook.filter((d) => d.riskLevel !== "normal").map((d) => {
          const riskColor = d.riskLevel === "high" ? "#DC2626" : "#D97706";
          const riskEmoji = d.riskLevel === "high" ? "🔴" : "🟡";
          const riskLabel = d.riskLevel === "high" ? "High" : "Moderate";
          const waitLabel = d.waitMinutes ? ` (~${d.waitMinutes}min)` : "";
          return `
        <tr>
          <td style="padding: 10px 14px; border-top: 1px solid #FEE2E2;">
            <strong style="color: #0D1F3C; font-size: 13px;">${d.origin} → ${d.destination}</strong><br/>
            <span style="font-size: 11px; color: #6B7B8D;">${d.crossingPoint}</span>
            ${d.patternNote ? `<br/><span style="font-size: 11px; color: #4A5568; font-style: italic;">${d.patternNote}</span>` : ""}
            ${d.tariffCategoryFlag ? `<br/><span style="font-size: 11px; color: #DC2626;">⚠ Tariff-category cargo — elevated CBP inspection</span>` : ""}
          </td>
          <td style="padding: 10px 14px; border-top: 1px solid #FEE2E2; text-align: right; vertical-align: top;">
            <span style="font-size: 14px; font-weight: bold; color: ${riskColor};">${riskEmoji} ${riskLabel}${waitLabel}</span>
          </td>
        </tr>`;
        }).join("")}
      </tbody>
    </table>
    <p style="margin: 6px 0 0 0; font-size: 11px; color: #A0AEC0;">Build crossing delays into transit time quotes for US-MX lanes. Mon/Fri are historically worst days. <a href="https://bwt.cbp.gov" style="color: #A0AEC0;">Live CBP data →</a></p>
  </div>` : ""}

  <div style="margin-top: 20px; text-align: center;">
    <a href="https://lanebrief.com/dashboard" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 6px;">
      View Full Briefs on Dashboard →
    </a>
  </div>

  <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2F5F2;">
    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
      <tr>
        <td style="background-color: #00C2A8; height: 3px; font-size: 0; line-height: 0;">&nbsp;</td>
      </tr>
    </table>
    <p style="margin: 12px 0 4px 0; font-size: 16px; font-weight: bold; color: #0D1F3C;">LaneBrief Intelligence</p>
    <p style="margin: 0; font-size: 12px; color: #6B7B8D;">
      <a href="mailto:intel@lanebrief.com" style="color: #0D1F3C; text-decoration: none;">intel@lanebrief.com</a>
      &nbsp;·&nbsp;
      <a href="https://lanebrief.com" style="color: #00C2A8; text-decoration: none;">lanebrief.com</a>
    </p>
    <p style="margin: 8px 0 0 0; font-size: 11px; color: #A0AEC0;">
      You received this because you have saved lanes on LaneBrief.
      <a href="https://lanebrief.com/dashboard" style="color: #A0AEC0;">Manage your lanes</a>
    </p>
  </div>
</div>`;
}

export async function GET(req: Request) {
  // Verify Vercel cron authorization
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = getDb();

  // Load all lanes with their per-lane threshold
  const allLanes = await db
    .select({
      laneId: lanes.id,
      origin: lanes.origin,
      destination: lanes.destination,
      equipment: lanes.equipment,
      alertThresholdPct: lanes.alertThresholdPct,
      userId: lanes.userId,
    })
    .from(lanes);

  if (allLanes.length === 0) {
    return Response.json({ ok: true, message: "No lanes to process" });
  }

  // Load only opted-in users
  const userIds = [...new Set(allLanes.map((l) => l.userId))];
  const userRows = await db
    .select({ id: users.id, email: users.email, alertOptIn: users.alertOptIn, alertMode: users.alertMode })
    .from(users)
    .where(inArray(users.id, userIds));

  const userEmailMap = new Map(userRows.map((u) => [u.id, u.email]));
  // weekly-digest only fires for users who opted in AND chose digest mode (or left it at default)
  const optedInUserIds = new Set(userRows.filter((u) => u.alertOptIn && u.alertMode === "digest").map((u) => u.id));

  const lanesWithUsers: LaneWithUser[] = allLanes
    .filter((l) => optedInUserIds.has(l.userId))
    .map((l) => ({
      ...l,
      userEmail: userEmailMap.get(l.userId) ?? "",
    }))
    .filter((l) => l.userEmail !== "");

  // Deduplicate by O/D/equipment to batch AI calls
  const uniquePairs = new Map<string, { origin: string; destination: string; equipment: string }>();
  for (const l of lanesWithUsers) {
    const key = `${l.origin}||${l.destination}||${l.equipment}`;
    uniquePairs.set(key, { origin: l.origin, destination: l.destination, equipment: l.equipment });
  }

  // Get current rates for all unique pairs
  const rateCache = new Map<string, RateEstimate>();
  for (const [key, pair] of uniquePairs) {
    try {
      const estimate = await getAIRateEstimate(pair.origin, pair.destination, pair.equipment);
      rateCache.set(key, estimate);
    } catch (err) {
      console.error(`[weekly-digest] Rate fetch failed for ${key}:`, err);
    }
  }

  // Load last snapshots for all lanes
  const laneIds = lanesWithUsers.map((l) => l.laneId);
  const lastSnapshots = await db
    .select()
    .from(rateSnapshots)
    .where(inArray(rateSnapshots.laneId, laneIds))
    .orderBy(desc(rateSnapshots.generatedAt));

  // Keep only the most recent snapshot per lane
  const lastSnapshotByLane = new Map<string, typeof lastSnapshots[0]>();
  for (const snap of lastSnapshots) {
    if (!lastSnapshotByLane.has(snap.laneId)) {
      lastSnapshotByLane.set(snap.laneId, snap);
    }
  }

  // Store new snapshots and build per-user alert lists
  const userAlerts = new Map<
    string,
    { origin: string; destination: string; equipment: string; oldRate: number | null; newRate: number; deltaPct: number | null; insight: string; usmcaRisk: "high" | "medium" | null }[]
  >();

  for (const lane of lanesWithUsers) {
    const key = `${lane.origin}||${lane.destination}||${lane.equipment}`;
    const estimate = rateCache.get(key);
    if (!estimate) continue;

    const lastSnap = lastSnapshotByLane.get(lane.laneId);
    const oldRate = lastSnap?.marketAvgUsdPerMile ?? null;
    const newRate = estimate.marketAvgUsdPerMile;

    let deltaPct: number | null = null;
    let shouldAlert = false;

    if (oldRate !== null) {
      deltaPct = ((newRate - oldRate) / oldRate) * 100;
      shouldAlert = Math.abs(deltaPct) >= lane.alertThresholdPct;
    } else {
      // First snapshot — always send welcome brief
      shouldAlert = true;
    }

    // Always persist new snapshot
    await db.insert(rateSnapshots).values({
      id: randomUUID(),
      laneId: lane.laneId,
      origin: lane.origin,
      destination: lane.destination,
      equipment: lane.equipment,
      ratePerMile: newRate,
      marketAvgUsdPerMile: newRate,
      deltaPct: deltaPct ?? 0,
      verdict: deltaPct === null ? "baseline" : deltaPct > 3 ? "above_market" : deltaPct < -3 ? "below_market" : "at_market",
      disclaimer: "AI-estimated",
    });

    if (shouldAlert) {
      const alerts = userAlerts.get(lane.userId) ?? [];
      alerts.push({
        origin: lane.origin,
        destination: lane.destination,
        equipment: lane.equipment,
        oldRate,
        newRate,
        deltaPct: deltaPct !== null ? Math.round(deltaPct * 10) / 10 : null,
        insight: estimate.insight,
        usmcaRisk: getUSMCAFlag(lane.origin, lane.destination, lane.equipment),
      });
      userAlerts.set(lane.userId, alerts);
    }
  }

  // Load tender acceptance cache for all user lanes (most recent per lane)
  const tenderCacheRows = laneIds.length > 0
    ? await db
        .select()
        .from(tenderAcceptanceCache)
        .where(inArray(tenderAcceptanceCache.laneId, laneIds))
        .orderBy(desc(tenderAcceptanceCache.generatedAt))
    : [];

  const tenderByLane = new Map<string, typeof tenderCacheRows[0]>();
  for (const row of tenderCacheRows) {
    if (!tenderByLane.has(row.laneId)) tenderByLane.set(row.laneId, row);
  }

  // Build per-user at-risk lanes (high + medium risk, sorted by acceptance pct asc, top 3)
  const userAtRiskLanes = new Map<string, AtRiskLane[]>();
  for (const lane of lanesWithUsers) {
    const score = tenderByLane.get(lane.laneId);
    if (!score || score.riskLevel === "low") continue;
    const bucket = userAtRiskLanes.get(lane.userId) ?? [];
    bucket.push({
      origin: lane.origin,
      destination: lane.destination,
      equipment: lane.equipment,
      estimatedAcceptancePct: score.estimatedAcceptancePct,
      riskLevel: score.riskLevel as "low" | "medium" | "high",
      reasoning: score.reasoning,
    });
    userAtRiskLanes.set(lane.userId, bucket);
  }
  // Sort by lowest acceptance first, cap at 3
  for (const [userId, bucket] of userAtRiskLanes) {
    userAtRiskLanes.set(
      userId,
      bucket.sort((a, b) => a.estimatedAcceptancePct - b.estimatedAcceptancePct).slice(0, 3)
    );
  }

  // Send digest emails
  let emailsSent = 0;
  const resend = getResend();

  for (const [userId, alerts] of userAlerts) {
    const email = userEmailMap.get(userId);
    if (!email || alerts.length === 0) continue;

    const hasMovements = alerts.some((a) => a.deltaPct !== null && a.deltaPct !== 0);
    const subject = hasMovements
      ? `⚡ Lane alert: ${alerts[0].origin} → ${alerts[0].destination} moved ${Math.abs(alerts[0].deltaPct ?? 0).toFixed(1)}%`
      : `Your weekly LaneBrief digest`;

    const atRisk = userAtRiskLanes.get(userId) ?? [];

    // Build crossing delay outlook for this user's US-MX lanes
    const userLanesForDelay = lanesWithUsers.filter((l) => l.userId === userId);
    const delayOutlook: DelayOutlaneItem[] = [];
    for (const l of userLanesForDelay) {
      const crossing = detectUSMXCrossing({ origin: l.origin, destination: l.destination });
      if (!crossing) continue;
      const result = getPatternDelayResult({ origin: l.origin, destination: l.destination, equipment: l.equipment });
      if (result.crossingPoint) {
        delayOutlook.push({
          origin: l.origin,
          destination: l.destination,
          crossingPoint: result.crossingPoint,
          riskLevel: result.riskLevel,
          waitMinutes: result.waitMinutes,
          patternNote: result.patternNote,
          tariffCategoryFlag: result.tariffCategoryFlag,
        });
      }
    }

    try {
      await resend.emails.send({
        from: FROM,
        replyTo: "intel@lanebrief.com",
        to: email,
        subject,
        html: buildDigestEmailHtml(alerts, atRisk, delayOutlook),
      });
      emailsSent++;
    } catch (err) {
      console.error(`[weekly-digest] Failed to send to ${email}:`, err);
    }
  }

  console.log(
    `[weekly-digest] Done. Processed ${lanesWithUsers.length} lanes, sent ${emailsSent} emails.`
  );

  return Response.json({
    ok: true,
    lanesProcessed: lanesWithUsers.length,
    uniquePairs: uniquePairs.size,
    emailsSent,
  });
}
