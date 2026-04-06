import { getDb } from "@/lib/db";
import { users, lanes } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { Resend } from "resend";

// POST /api/admin/weekly-report-activation-blast
// One-time blast: Weekly LaneBrief Intelligence Report first-report-ready announcement
// Protected by CRON_SECRET. Send once — do not run more than once in production.

const FROM = "LaneBrief Intel <intel@email.lanebrief.com>";

function buildWeeklyReportActivationHtml(firstName: string): string {
  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.7; color: #0D1F3C; max-width: 600px;">
  <div style="background: linear-gradient(135deg, #0D1F3C 0%, #1a3a5c 100%); padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #FFFFFF;">
      <span style="color: #00C2A8;">▶</span> LaneBrief Intelligence
    </p>
    <p style="margin: 4px 0 0 0; font-size: 13px; color: #A0AEC0;">Your first LaneBrief Weekly Report is ready</p>
  </div>

  <div style="border: 1px solid #E2F5F2; border-top: none; border-radius: 0 0 8px 8px; padding: 28px 28px 24px;">
    <p style="margin: 0 0 16px 0;">Hey ${firstName},</p>

    <p style="margin: 0 0 16px 0;">
      Every Monday morning, LaneBrief will send you a personalized freight market brief.
    </p>

    <div style="background-color: #F0FDFA; border-radius: 8px; padding: 20px 24px; margin: 0 0 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #0D1F3C;">Your report covers:</p>
      <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #4A5568;">
        <li style="margin-bottom: 8px;">Rate movements on your saved lanes (week-over-week)</li>
        <li style="margin-bottom: 8px;">7-day forecast for each lane</li>
        <li style="margin-bottom: 8px;">Carrier risk flags on lanes with recent volatility</li>
        <li style="margin-bottom: 8px;">Top market signal of the week (tariffs, capacity, weather)</li>
      </ul>
    </div>

    <p style="margin: 0 0 16px 0;">
      The first report for your lanes is ready now.
    </p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="https://lanebrief.com/dashboard"
         style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 6px;">
        View your Weekly Report →
      </a>
    </div>

    <p style="margin: 0 0 16px 0; font-size: 14px; color: #4A5568;">
      Reports deliver every Monday at 7am CT. No action needed — it is automatic for all users with saved lanes.
    </p>

    <p style="margin: 0;">— Nick, LaneBrief</p>
  </div>

  <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #E2F5F2;">
    <p style="margin: 0; font-size: 12px; color: #6B7B8D;">
      <a href="mailto:intel@lanebrief.com" style="color: #0D1F3C; text-decoration: none;">intel@lanebrief.com</a>
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

  const allLanes = await db.select({ userId: lanes.userId }).from(lanes);

  if (allLanes.length === 0) {
    return Response.json({ ok: true, message: "No lanes found — nobody to blast" });
  }

  const userIds = [...new Set(allLanes.map((l) => l.userId))];
  const userRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, userIds));

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  const failed: string[] = [];

  for (const user of userRows) {
    if (!user.email) continue;

    const localPart = user.email.split("@")[0] ?? "";
    const rawFirst = localPart.split(/[._+]/)[0] ?? "";
    const firstName =
      rawFirst.length > 1
        ? rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase()
        : "there";

    try {
      await resend.emails.send({
        from: FROM,
        replyTo: "intel@lanebrief.com",
        to: user.email,
        subject: "Your first LaneBrief Weekly Report is ready",
        html: buildWeeklyReportActivationHtml(firstName),
      });
      sent++;
    } catch (err) {
      console.error(`[weekly-report-activation-blast] Failed to send to ${user.email}:`, err);
      failed.push(user.email);
    }
  }

  console.log(`[weekly-report-activation-blast] Done. Sent ${sent}/${userRows.length}. Failed: ${failed.length}`);

  return Response.json({
    ok: true,
    totalUsers: userRows.length,
    sent,
    failed,
  });
}
