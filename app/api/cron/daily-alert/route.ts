import { getDb } from "@/lib/db";
import { users, lanes, rateSnapshots } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { generateText } from "ai";
import { Resend } from "resend";
import { randomUUID } from "crypto";

// Vercel Cron: daily at 10am ET (15:00 UTC), weekdays only
// vercel.json schedule: "0 15 * * MON-FRI"

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = "LaneBrief Intel <intel@email.lanebrief.com>";

type LaneRow = {
  laneId: string;
  origin: string;
  destination: string;
  equipment: string;
  alertThresholdPct: number;
  userId: string;
  userEmail: string;
};

async function getAIRateEstimate(
  origin: string,
  destination: string,
  equipment: string
): Promise<{ marketAvgUsdPerMile: number; insight: string }> {
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

function buildAlertEmailHtml(
  origin: string,
  destination: string,
  equipment: string,
  newRate: number,
  deltaPct: number,
  threshold: number,
  insight: string
): string {
  const isUp = deltaPct >= 0;
  const arrowColor = isUp ? "#E53E3E" : "#00C2A8";
  const arrow = isUp ? "▲" : "▼";
  const eq = equipment.replace("_", " ");
  const absDelta = Math.abs(deltaPct).toFixed(1);

  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
  <div style="background: linear-gradient(135deg, #0D1F3C 0%, #1a3a5c 100%); padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #FFFFFF;">
      <span style="color: #00C2A8;">▶</span> LaneBrief Rate Alert
    </p>
    <p style="margin: 4px 0 0 0; font-size: 13px; color: #A0AEC0;">
      Your lane moved more than ${threshold}% in 24h
    </p>
  </div>

  <div style="border: 1px solid #E2F5F2; border-top: none; border-radius: 0 0 8px 8px; overflow: hidden;">
    <div style="padding: 24px 28px;">
      <p style="margin: 0 0 6px 0; font-size: 18px; font-weight: bold; color: #0D1F3C;">
        ${origin} → ${destination}
      </p>
      <p style="margin: 0 0 20px 0; font-size: 13px; color: #6B7B8D; text-transform: capitalize;">${eq}</p>

      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 16px; background-color: #F0FDFA; border-radius: 8px; text-align: center; width: 50%;">
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #6B7B8D; text-transform: uppercase; letter-spacing: 0.05em;">Current Rate</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #0D1F3C;">$${newRate.toFixed(2)}/mi</p>
          </td>
          <td style="width: 20px;"></td>
          <td style="padding: 16px; background-color: #FFF5F5; border-radius: 8px; text-align: center; width: 50%;">
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #6B7B8D; text-transform: uppercase; letter-spacing: 0.05em;">24h Change</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: ${arrowColor};">
              ${arrow} ${absDelta}%
            </p>
          </td>
        </tr>
      </table>

      <div style="margin-top: 20px; padding: 14px 18px; background-color: #F7FAFC; border-radius: 8px; border-left: 3px solid #00C2A8;">
        <p style="margin: 0; font-size: 13px; color: #4A5568; font-style: italic;">
          💡 ${insight}
        </p>
      </div>

      <div style="margin-top: 24px; text-align: center;">
        <a href="https://lanebrief.com/dashboard" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 6px;">
          View Lane on Dashboard →
        </a>
      </div>

      <div style="margin-top: 20px; padding: 12px 16px; background-color: #FFFBEB; border-radius: 6px; border: 1px solid #FDE68A;">
        <p style="margin: 0; font-size: 12px; color: #92400E;">
          <strong>Note:</strong> Rate is AI-estimated based on market patterns. Not a substitute for live market data.
        </p>
      </div>
    </div>
  </div>

  <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #E2F5F2;">
    <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: bold; color: #0D1F3C;">LaneBrief Intelligence</p>
    <p style="margin: 0; font-size: 12px; color: #6B7B8D;">
      <a href="mailto:intel@lanebrief.com" style="color: #0D1F3C; text-decoration: none;">intel@lanebrief.com</a>
      &nbsp;·&nbsp;
      <a href="https://lanebrief.com" style="color: #00C2A8; text-decoration: none;">lanebrief.com</a>
    </p>
    <p style="margin: 8px 0 0 0; font-size: 11px; color: #A0AEC0;">
      You received this because this lane exceeded your alert threshold.
      <a href="https://lanebrief.com/dashboard" style="color: #A0AEC0;">Manage thresholds</a>
    </p>
  </div>
</div>`;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = getDb();

  // Load all lanes
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

  // Load opted-in users only
  const userIds = [...new Set(allLanes.map((l) => l.userId))];
  const userRows = await db
    .select({ id: users.id, email: users.email, alertOptIn: users.alertOptIn, alertMode: users.alertMode })
    .from(users)
    .where(inArray(users.id, userIds));

  const userEmailMap = new Map(userRows.map((u) => [u.id, u.email]));
  // daily-alert only fires for users who opted in AND chose instant mode
  const optedInUserIds = new Set(userRows.filter((u) => u.alertOptIn && u.alertMode === "instant").map((u) => u.id));

  const laneRows: LaneRow[] = allLanes
    .filter((l) => optedInUserIds.has(l.userId))
    .map((l) => ({ ...l, userEmail: userEmailMap.get(l.userId) ?? "" }))
    .filter((l) => l.userEmail !== "");

  if (laneRows.length === 0) {
    return Response.json({ ok: true, message: "No opted-in lanes" });
  }

  // Deduplicate O/D/equipment pairs to minimize AI calls
  const uniquePairs = new Map<string, { origin: string; destination: string; equipment: string }>();
  for (const l of laneRows) {
    const key = `${l.origin}||${l.destination}||${l.equipment}`;
    uniquePairs.set(key, { origin: l.origin, destination: l.destination, equipment: l.equipment });
  }

  const rateCache = new Map<string, { marketAvgUsdPerMile: number; insight: string }>();
  for (const [key, pair] of uniquePairs) {
    try {
      const estimate = await getAIRateEstimate(pair.origin, pair.destination, pair.equipment);
      rateCache.set(key, estimate);
    } catch (err) {
      console.error(`[daily-alert] Rate fetch failed for ${key}:`, err);
    }
  }

  // Load most recent snapshot per lane to compute delta
  const laneIds = laneRows.map((l) => l.laneId);
  const recentSnapshots = await db
    .select()
    .from(rateSnapshots)
    .where(inArray(rateSnapshots.laneId, laneIds))
    .orderBy(desc(rateSnapshots.generatedAt));

  const lastSnapshotByLane = new Map<string, typeof recentSnapshots[0]>();
  for (const snap of recentSnapshots) {
    if (!lastSnapshotByLane.has(snap.laneId)) {
      lastSnapshotByLane.set(snap.laneId, snap);
    }
  }

  const resend = getResend();
  let alertsSent = 0;

  for (const lane of laneRows) {
    const key = `${lane.origin}||${lane.destination}||${lane.equipment}`;
    const estimate = rateCache.get(key);
    if (!estimate) continue;

    const lastSnap = lastSnapshotByLane.get(lane.laneId);
    const oldRate = lastSnap?.marketAvgUsdPerMile ?? null;
    const newRate = estimate.marketAvgUsdPerMile;

    // Persist new snapshot regardless
    await db.insert(rateSnapshots).values({
      id: randomUUID(),
      laneId: lane.laneId,
      origin: lane.origin,
      destination: lane.destination,
      equipment: lane.equipment,
      ratePerMile: newRate,
      marketAvgUsdPerMile: newRate,
      deltaPct: oldRate !== null ? ((newRate - oldRate) / oldRate) * 100 : 0,
      verdict: oldRate === null ? "baseline" : newRate > oldRate * 1.03 ? "above_market" : newRate < oldRate * 0.97 ? "below_market" : "at_market",
      disclaimer: "AI-estimated",
    });

    // Only alert if we have a prior baseline and threshold is crossed
    if (oldRate === null) continue;

    const deltaPct = ((newRate - oldRate) / oldRate) * 100;
    if (Math.abs(deltaPct) < lane.alertThresholdPct) continue;

    const subject = `⚡ Lane alert: ${lane.origin} → ${lane.destination} moved ${Math.abs(deltaPct).toFixed(1)}%`;

    try {
      await resend.emails.send({
        from: FROM,
        replyTo: "intel@lanebrief.com",
        to: lane.userEmail,
        subject,
        html: buildAlertEmailHtml(
          lane.origin,
          lane.destination,
          lane.equipment,
          newRate,
          Math.round(deltaPct * 10) / 10,
          lane.alertThresholdPct,
          estimate.insight
        ),
      });
      alertsSent++;
    } catch (err) {
      console.error(`[daily-alert] Failed to send alert to ${lane.userEmail}:`, err);
    }
  }

  console.log(`[daily-alert] Done. Checked ${laneRows.length} lanes, sent ${alertsSent} alerts.`);

  return Response.json({
    ok: true,
    lanesChecked: laneRows.length,
    alertsSent,
  });
}
