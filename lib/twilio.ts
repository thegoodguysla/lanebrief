import twilio from "twilio";

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio env vars not set");
  return twilio(sid, token);
}

const FROM = process.env.TWILIO_FROM_NUMBER ?? "";

// Returns true if current time is within carrier quiet hours (9pm–7am local to US Central).
// We use a simple UTC offset: Central is UTC-5 (CST) or UTC-6 (CDT).
// Rather than full tz math, we approximate: block 01:00–13:00 UTC (9pm–7am CT both seasons).
function isQuietHours(): boolean {
  const utcHour = new Date().getUTCHours();
  // 01:00–12:59 UTC ≈ 9pm–6:59am CT (CDT) or 8pm–5:59am CT (CST)
  // We block a conservative window: 02:00–12:59 UTC (8pm–6:59am CST / 9pm–7:59am CDT)
  return utcHour >= 2 && utcHour < 13;
}

export async function sendSms(to: string, body: string): Promise<void> {
  if (isQuietHours()) {
    console.log(`[twilio] Quiet hours — skipping SMS to ${to}`);
    return;
  }
  const client = getClient();
  await client.messages.create({ from: FROM, to, body });
}

export function buildRateAlertSms(params: {
  origin: string;
  destination: string;
  deltaPct: number;
  newRate: number;
}): string {
  const { origin, destination, deltaPct, newRate } = params;
  const direction = deltaPct >= 0 ? "up" : "down";
  const absDelta = Math.abs(deltaPct).toFixed(1);
  // Keep under 160 chars
  const msg = `LaneBrief: ${origin}-${destination} ${direction} ${absDelta}% ($${newRate.toFixed(2)}/mi). View brief: lanebrief.com/dashboard`;
  return msg.slice(0, 160);
}

export function buildWeeklySummarySms(params: {
  laneCount: number;
  topLane?: string;
  topDelta?: number;
}): string {
  const { laneCount, topLane, topDelta } = params;
  let msg = `LaneBrief weekly: ${laneCount} lane${laneCount === 1 ? "" : "s"} tracked.`;
  if (topLane && topDelta !== undefined) {
    const dir = topDelta >= 0 ? "up" : "down";
    msg += ` ${topLane} ${dir} ${Math.abs(topDelta).toFixed(0)}%.`;
  }
  msg += " Full report: lanebrief.com/dashboard";
  return msg.slice(0, 160);
}
