import { getDb } from "@/lib/db";
import { users, lanes, rateSnapshots, zapierHooks, zapierAlertEvents } from "@/lib/db/schema";
import { desc, inArray, eq } from "drizzle-orm";
import { generateText } from "ai";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import { sendSms, buildRateAlertSms } from "@/lib/twilio";

// Vercel Cron: daily at 10am ET (15:00 UTC), weekdays only
// vercel.json schedule: "0 15 * * MON-FRI"

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = "LaneBrief Intel <intel@email.lanebrief.com>";

// Tariff flag detection — mirrors dashboard logic (AUT-166)
const MX_HIGH_RISK = [
  "nuevo laredo", "laredo",
  "ciudad juarez", "ciudad juárez", "juarez", "juárez", "el paso",
  "reynosa", "pharr", "mcallen",
  "piedras negras", "eagle pass",
  "ciudad acuna", "ciudad acuña", "del rio",
  "nogales",
  "otay mesa", "tijuana",
];
const MX_MEDIUM_RISK = ["calexico", "mexicali"];
const MX_GENERAL = [
  "mexico", " mx", ",mx", "monterrey", "guadalajara", "cdmx", "mexico city",
  "matamoros", "saltillo", "hermosillo", "chihuahua", "torreon",
];
const CA_HIGH_RISK = ["detroit", "windsor", "port huron", "sarnia"];
const CA_MEDIUM_RISK = [
  "buffalo", "fort erie", "blaine", "surrey", "pembina", "emerson", "sweetgrass", "coutts",
];
const CA_GENERAL = [
  "canada", "ontario", "quebec", "british columbia", "alberta", "manitoba",
  "saskatchewan", "nova scotia", "new brunswick", "prince edward island", "newfoundland",
  " on,", " qc,", " ab,", " mb,", " sk,", " ns,", " nb,", " pe,", " nl,",
  "toronto", "montreal", "vancouver", "calgary", "edmonton", "ottawa", "winnipeg",
  "halifax", "hamilton", "london, on", "kitchener",
];

type TariffFlag = { region: "MX" | "CA"; risk: "high" | "medium" } | null;

function getTariffFlag(origin: string, destination: string): TariffFlag {
  const text = `${origin} ${destination}`.toLowerCase();
  if (MX_HIGH_RISK.some((kw) => text.includes(kw))) return { region: "MX", risk: "high" };
  if (CA_HIGH_RISK.some((kw) => text.includes(kw))) return { region: "CA", risk: "high" };
  if (MX_MEDIUM_RISK.some((kw) => text.includes(kw))) return { region: "MX", risk: "medium" };
  if (CA_MEDIUM_RISK.some((kw) => text.includes(kw))) return { region: "CA", risk: "medium" };
  if (MX_GENERAL.some((kw) => text.includes(kw))) return { region: "MX", risk: "medium" };
  if (CA_GENERAL.some((kw) => text.includes(kw))) return { region: "CA", risk: "medium" };
  return null;
}

// Stable A/B split — hash last char of laneId into bucket A or B
function getSubjectVariant(laneId: string): "A" | "B" {
  const code = laneId.charCodeAt(laneId.length - 1);
  return code % 2 === 0 ? "A" : "B";
}

type LaneRow = {
  laneId: string;
  origin: string;
  destination: string;
  equipment: string;
  alertThresholdPct: number;
  userId: string;
  userEmail: string;
  userPhone: string | null;
  smsAlertOptIn: boolean;
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

function buildAlertEmailHtml(params: {
  origin: string;
  destination: string;
  equipment: string;
  oldRate: number;
  newRate: number;
  deltaPct: number;
  threshold: number;
  insight: string;
  tariffFlag: TariffFlag;
}): string {
  const { origin, destination, equipment, oldRate, newRate, deltaPct, threshold, insight, tariffFlag } = params;
  const isUp = deltaPct >= 0;
  const arrowColor = isUp ? "#E53E3E" : "#00C2A8";
  const arrow = isUp ? "▲" : "▼";
  const eq = equipment.replace(/_/g, " ");
  const absDelta = Math.abs(deltaPct).toFixed(1);
  const direction = isUp ? "up" : "down";

  const directionAdvice = isUp
    ? "Capacity is tightening on this corridor. If you have loads pending, lock in carrier rates now before the market adjusts further."
    : "Rate compression is happening. Good time to win competitive bids, but watch your margin — do not undercut yourself.";

  const tariffSection = tariffFlag
    ? `
<div style="margin-top: 16px; padding: 12px 16px; background-color: #FFF5F5; border-radius: 6px; border-left: 3px solid #E53E3E;">
  <p style="margin: 0; font-size: 13px; color: #C53030;">
    <strong>⚠ Tariff Impact:</strong> This lane is flagged for US-${tariffFlag.region} tariff volatility${tariffFlag.risk === "high" ? " (high exposure)" : ""}.
    Rate movement may include tariff-driven pressure on this corridor.
  </p>
</div>`
    : "";

  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
  <div style="background: linear-gradient(135deg, #0D1F3C 0%, #1a3a5c 100%); padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #FFFFFF;">
      <span style="color: #00C2A8;">▶</span> LaneBrief Rate Alert
    </p>
    <p style="margin: 4px 0 0 0; font-size: 13px; color: #A0AEC0;">
      Your ${origin} → ${destination} lane moved more than ${threshold}%
    </p>
  </div>

  <div style="border: 1px solid #E2F5F2; border-top: none; border-radius: 0 0 8px 8px; padding: 24px 28px;">
    <p style="margin: 0 0 6px 0; font-size: 18px; font-weight: bold; color: #0D1F3C;">
      ${origin} → ${destination}
    </p>
    <p style="margin: 0 0 20px 0; font-size: 13px; color: #6B7B8D; text-transform: capitalize;">${eq}</p>

    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 16px; background-color: #F0FDFA; border-radius: 8px; text-align: center; width: 30%;">
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #6B7B8D; text-transform: uppercase; letter-spacing: 0.05em;">Old Rate</p>
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: #6B7B8D;">$${oldRate.toFixed(2)}/mi</p>
        </td>
        <td style="width: 16px;"></td>
        <td style="padding: 16px; background-color: #F0FDFA; border-radius: 8px; text-align: center; width: 30%;">
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #6B7B8D; text-transform: uppercase; letter-spacing: 0.05em;">New Rate</p>
          <p style="margin: 0; font-size: 22px; font-weight: bold; color: #0D1F3C;">$${newRate.toFixed(2)}/mi</p>
        </td>
        <td style="width: 16px;"></td>
        <td style="padding: 16px; background-color: ${isUp ? "#FFF5F5" : "#F0FDFA"}; border-radius: 8px; text-align: center; width: 30%;">
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #6B7B8D; text-transform: uppercase; letter-spacing: 0.05em;">Direction</p>
          <p style="margin: 0; font-size: 22px; font-weight: bold; color: ${arrowColor};">
            ${arrow} ${absDelta}%
          </p>
        </td>
      </tr>
    </table>

    ${tariffSection}

    <div style="margin-top: 20px; padding: 14px 18px; background-color: #F7FAFC; border-radius: 8px; border-left: 3px solid #00C2A8;">
      <p style="margin: 0 0 6px 0; font-size: 13px; color: #4A5568;">
        <strong>What this means for your next quote:</strong>
      </p>
      <p style="margin: 0; font-size: 13px; color: #4A5568;">${directionAdvice}</p>
    </div>

    <div style="margin-top: 16px; padding: 12px 16px; background-color: #F7FAFC; border-radius: 6px;">
      <p style="margin: 0; font-size: 13px; color: #4A5568; font-style: italic;">💡 ${insight}</p>
    </div>

    <div style="margin-top: 24px; text-align: center;">
      <a href="https://lanebrief.com/dashboard" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 6px;">
        See full lane brief → View on LaneBrief
      </a>
    </div>

    <p style="margin: 16px 0 0 0; font-size: 12px; color: #A0AEC0; text-align: center;">
      Want to adjust your alert threshold?
      <a href="https://lanebrief.com/dashboard" style="color: #6B7B8D;">Log in and update your lane settings.</a>
    </p>

    <div style="margin-top: 16px; padding: 12px 16px; background-color: #FFFBEB; border-radius: 6px; border: 1px solid #FDE68A;">
      <p style="margin: 0; font-size: 12px; color: #92400E;">
        <strong>Note:</strong> Rate is AI-estimated based on market patterns. Not a substitute for live market data.
      </p>
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

  // Load opted-in users only (instant mode)
  const userIds = [...new Set(allLanes.map((l) => l.userId))];
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      alertOptIn: users.alertOptIn,
      alertMode: users.alertMode,
      phone: users.phone,
      phoneVerified: users.phoneVerified,
      smsAlertOptIn: users.smsAlertOptIn,
    })
    .from(users)
    .where(inArray(users.id, userIds));

  const userMap = new Map(userRows.map((u) => [u.id, u]));
  const optedInUserIds = new Set(
    userRows.filter((u) => u.alertOptIn && u.alertMode === "instant").map((u) => u.id)
  );

  const laneRows: LaneRow[] = allLanes
    .filter((l) => optedInUserIds.has(l.userId))
    .map((l) => {
      const u = userMap.get(l.userId);
      return {
        ...l,
        userEmail: u?.email ?? "",
        userPhone: u?.phoneVerified ? (u.phone ?? null) : null,
        smsAlertOptIn: u?.smsAlertOptIn ?? false,
      };
    })
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
  let variantACnt = 0;
  let variantBCnt = 0;

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
      verdict:
        oldRate === null
          ? "baseline"
          : newRate > oldRate * 1.03
          ? "above_market"
          : newRate < oldRate * 0.97
          ? "below_market"
          : "at_market",
      disclaimer: "AI-estimated",
    });

    // Only alert if we have a prior baseline and threshold is crossed
    if (oldRate === null) continue;

    const deltaPct = ((newRate - oldRate) / oldRate) * 100;
    if (Math.abs(deltaPct) < lane.alertThresholdPct) continue;

    const absDelta = Math.abs(deltaPct).toFixed(1);
    const direction = deltaPct >= 0 ? "up" : "down";
    const tariffFlag = getTariffFlag(lane.origin, lane.destination);

    // A/B subject line test (50/50 split by laneId)
    const variant = getSubjectVariant(lane.laneId);
    const subject =
      variant === "A"
        ? `Your ${lane.origin} → ${lane.destination} lane just moved ${absDelta}%`
        : `Rate alert: ${lane.origin} → ${lane.destination} ${direction} ${absDelta}% this week`;

    if (variant === "A") variantACnt++; else variantBCnt++;

    try {
      await resend.emails.send({
        from: FROM,
        replyTo: "intel@lanebrief.com",
        to: lane.userEmail,
        subject,
        html: buildAlertEmailHtml({
          origin: lane.origin,
          destination: lane.destination,
          equipment: lane.equipment,
          oldRate,
          newRate,
          deltaPct: Math.round(deltaPct * 10) / 10,
          threshold: lane.alertThresholdPct,
          insight: estimate.insight,
          tariffFlag,
        }),
      });
      alertsSent++;
    } catch (err) {
      console.error(`[daily-alert] Failed to send alert to ${lane.userEmail}:`, err);
    }

    // SMS alert — fire-and-forget, never blocks email delivery
    if (lane.smsAlertOptIn && lane.userPhone) {
      sendSms(
        lane.userPhone,
        buildRateAlertSms({ origin: lane.origin, destination: lane.destination, deltaPct, newRate }),
      ).catch((err) => {
        console.error(`[daily-alert] SMS failed for ${lane.userId}:`, err);
      });
    }

    // Fire Zapier webhooks for this user if they have a rate_alert subscription
    const zapierPayload = {
      lane: `${lane.origin} → ${lane.destination}`,
      origin: lane.origin,
      destination: lane.destination,
      equipment: lane.equipment,
      rate_per_mile: newRate,
      change_pct: Math.round(deltaPct * 10) / 10,
      direction: deltaPct >= 0 ? "up" : "down",
      threshold_pct: lane.alertThresholdPct,
      forecast: deltaPct >= 0 ? "up" : "down",
      tariff_flag: tariffFlag !== null,
      triggered_at: new Date().toISOString(),
    };

    // Persist event for polling triggers
    const eventId = randomUUID();
    try {
      await db.insert(zapierAlertEvents).values({
        id: eventId,
        userId: lane.userId,
        eventType: "rate_alert",
        payload: JSON.stringify(zapierPayload),
      });
    } catch (err) {
      console.error(`[daily-alert] Failed to store Zapier event for ${lane.userId}:`, err);
    }

    // Fire REST hooks (fire-and-forget — Zapier retries on failure)
    const hooks = await db
      .select({ hookUrl: zapierHooks.hookUrl })
      .from(zapierHooks)
      .where(eq(zapierHooks.userId, lane.userId));

    for (const hook of hooks.filter((h) => h.hookUrl)) {
      fetch(hook.hookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...zapierPayload, id: eventId }),
      }).catch((err) => {
        console.error(`[daily-alert] Zapier webhook delivery failed to ${hook.hookUrl}:`, err);
      });
    }
  }

  console.log(
    `[daily-alert] Done. Checked ${laneRows.length} lanes, sent ${alertsSent} alerts. Subject A: ${variantACnt}, B: ${variantBCnt}`
  );

  return Response.json({
    ok: true,
    lanesChecked: laneRows.length,
    alertsSent,
    subjectVariants: { A: variantACnt, B: variantBCnt },
  });
}
