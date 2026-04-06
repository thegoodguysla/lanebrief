import { getDb } from "@/lib/db";
import { users, lanes } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { Resend } from "resend";

// POST /api/admin/tariff-launch-blast
// One-time blast: Tariff-Impact Flag + Rate Alerts launch announcement
// Protected by CRON_SECRET. Send once — do not run more than once in production.

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = "Nick, LaneBrief <nick@email.lanebrief.com>";

function buildTariffLaunchHtml(firstName: string): string {
  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.7; color: #0D1F3C; max-width: 600px;">
  <div style="background: linear-gradient(135deg, #0D1F3C 0%, #1a3a5c 100%); padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #FFFFFF;">
      <span style="color: #00C2A8;">▶</span> LaneBrief
    </p>
    <p style="margin: 4px 0 0 0; font-size: 13px; color: #A0AEC0;">New: Tariff-Impact Flags on Your Lanes</p>
  </div>

  <div style="border: 1px solid #E2F5F2; border-top: none; border-radius: 0 0 8px 8px; padding: 28px 28px 24px;">
    <p style="margin: 0 0 16px 0;">Hey ${firstName},</p>

    <p style="margin: 0 0 16px 0;">Quick update from LaneBrief.</p>

    <p style="margin: 0 0 16px 0;">
      If you run any US-Mexico or US-Canada lanes, you have probably felt the rate volatility
      from the latest tariff changes. We built something to help.
    </p>

    <p style="margin: 0 0 12px 0; font-weight: bold;">Starting today, LaneBrief flags lanes with tariff exposure directly in your briefs.</p>

    <div style="background-color: #F0FDFA; border-radius: 8px; padding: 20px 24px; margin: 0 0 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #0D1F3C;">What you get:</p>
      <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #4A5568;">
        <li style="margin-bottom: 8px;">⚠️ <strong>Tariff-Impact badge</strong> on US-MX and US-CA lanes</li>
        <li style="margin-bottom: 8px;">Rate trend context (how tariffs are affecting spot vs contract)</li>
        <li style="margin-bottom: 8px;">Highlighted in your Rate Alert if movement exceeds your threshold</li>
      </ul>
    </div>

    <p style="margin: 0 0 16px 0;">
      This is not a guess — we are tracking the actual rate impact on specific corridors
      so you can adjust your quoting.
    </p>

    <div style="background-color: #FFF5F5; border-radius: 8px; padding: 20px 24px; margin: 0 0 20px 0; border-left: 3px solid #E53E3E;">
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #C53030;">Also new: Real-Time Rate Alerts</p>
      <p style="margin: 0; font-size: 14px; color: #4A5568;">
        Set a threshold on any lane and get an email when it moves beyond that.
        No more checking dashboards manually.
      </p>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="https://lanebrief.com/dashboard"
         style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 6px;">
        Check your lanes now → Log in to LaneBrief
      </a>
    </div>

    <p style="margin: 0 0 16px 0; font-size: 14px; color: #4A5568;">
      If you are not tracking US-MX or US-CA lanes today but want to start,
      add them in your lane settings. The tariff flag applies automatically.
    </p>

    <p style="margin: 0;">— Nick, LaneBrief</p>
  </div>

  <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #E2F5F2;">
    <p style="margin: 0; font-size: 12px; color: #6B7B8D;">
      <a href="mailto:nick@lanebrief.com" style="color: #0D1F3C; text-decoration: none;">nick@lanebrief.com</a>
      &nbsp;·&nbsp;
      <a href="https://lanebrief.com" style="color: #00C2A8; text-decoration: none;">lanebrief.com</a>
    </p>
    <p style="margin: 6px 0 0 0; font-size: 11px; color: #A0AEC0;">
      You received this because you have saved lanes on LaneBrief.
    </p>
  </div>
</div>`;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = getDb();

  // Get all users who have at least one saved lane
  const allLanes = await db
    .select({ userId: lanes.userId })
    .from(lanes);

  if (allLanes.length === 0) {
    return Response.json({ ok: true, message: "No lanes found — nobody to blast" });
  }

  const userIds = [...new Set(allLanes.map((l) => l.userId))];
  const userRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, userIds));

  const resend = getResend();
  let sent = 0;
  const failed: string[] = [];

  for (const user of userRows) {
    if (!user.email) continue;

    // Derive a first name from email (e.g. "john.doe@..." → "John"), fallback to "there"
    const localPart = user.email.split("@")[0] ?? "";
    const rawFirst = localPart.split(/[._+]/)[0] ?? "";
    const firstName =
      rawFirst.length > 1
        ? rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase()
        : "there";

    try {
      await resend.emails.send({
        from: FROM,
        replyTo: "nick@lanebrief.com",
        to: user.email,
        subject: "New: We are now flagging tariff-impacted lanes",
        html: buildTariffLaunchHtml(firstName),
      });
      sent++;
    } catch (err) {
      console.error(`[tariff-launch-blast] Failed to send to ${user.email}:`, err);
      failed.push(user.email);
    }
  }

  console.log(`[tariff-launch-blast] Done. Sent ${sent}/${userRows.length}. Failed: ${failed.length}`);

  return Response.json({
    ok: true,
    totalUsers: userRows.length,
    sent,
    failed,
  });
}
