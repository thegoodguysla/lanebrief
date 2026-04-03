import { getDb } from "@/lib/db";
import { users, lanes, rateSnapshots } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { generateText } from "ai";
import { Resend } from "resend";
import { randomUUID } from "crypto";

// Vercel Cron: every Monday 8am ET (13:00 UTC)
// vercel.json schedule: "0 13 * * 1"

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

function buildDigestEmailHtml(
  alerts: { origin: string; destination: string; equipment: string; oldRate: number | null; newRate: number; deltaPct: number | null; insight: string }[]
): string {
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

  <div style="margin-top: 20px; padding: 16px 20px; background-color: #F7FAFC; border-radius: 8px; border-left: 3px solid #00C2A8;">
    <p style="margin: 0; font-size: 13px; color: #4A5568;">
      <strong>Note:</strong> All rates are AI-estimated based on general market knowledge and seasonal patterns. Not a substitute for live market data.
    </p>
  </div>

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
    .select({ id: users.id, email: users.email, alertOptIn: users.alertOptIn })
    .from(users)
    .where(inArray(users.id, userIds));

  const userEmailMap = new Map(userRows.map((u) => [u.id, u.email]));
  const optedInUserIds = new Set(userRows.filter((u) => u.alertOptIn).map((u) => u.id));

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
    { origin: string; destination: string; equipment: string; oldRate: number | null; newRate: number; deltaPct: number | null; insight: string }[]
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
      });
      userAlerts.set(lane.userId, alerts);
    }
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

    try {
      await resend.emails.send({
        from: FROM,
        replyTo: "intel@lanebrief.com",
        to: email,
        subject,
        html: buildDigestEmailHtml(alerts),
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
