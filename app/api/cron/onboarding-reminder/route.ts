import { getDb } from "@/lib/db";
import { users, lanes } from "@/lib/db/schema";
import { and, gte, lte, isNull, eq } from "drizzle-orm";
import { Resend } from "resend";

// Vercel Cron: daily at 10am ET (15:00 UTC)
// Finds users who signed up ~24h ago with no lanes — sends a re-engagement nudge.

const FROM = "Nick Taylor <nick@email.lanebrief.com>";

function buildAbandonedOnboardingEmail(email: string): string {
  // We don't have the name at this point, so we use a friendly opener
  const firstName = email.split("@")[0].split(".")[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
  <p>Hi ${displayName},</p>

  <p>You signed up for LaneBrief yesterday but didn't finish setting up your first lane.</p>

  <p>It takes 2 minutes — and within 60 seconds of entering a lane, you'll have a full freight intelligence brief: rate trend, capacity signal, seasonal risk, and actionable bullets.</p>

  <p>
    <a href="https://lanebrief.com/onboarding" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 10px 24px; border-radius: 6px;">
      Finish my lane setup →
    </a>
  </p>

  <p style="font-size: 13px; color: #6B7B8D;">
    No credit card needed. You can add, remove, or change lanes anytime.
  </p>

  <p>— Nick</p>

  <table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.4; color: #0D1F3C; max-width: 480px;">
    <tr>
      <td style="padding: 16px 0 0 0;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="background-color: #00C2A8; height: 3px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 14px 0 4px 0;">
        <span style="font-size: 16px; font-weight: bold; color: #0D1F3C;">Nick Taylor</span>
        <span style="font-size: 13px; color: #6B7B8D; margin-left: 8px;">Founder &amp; Account Executive</span>
      </td>
    </tr>
    <tr>
      <td style="padding: 2px 0 10px 0;">
        <span style="font-size: 15px; font-weight: bold; color: #00C2A8;">&#9658;</span>
        <span style="font-size: 15px; font-weight: bold; color: #0D1F3C; margin-left: 4px;">LaneBrief</span>
        <span style="font-size: 11px; color: #6B7B8D; margin-left: 8px;">AI-Powered Freight Intelligence</span>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 0 12px 0;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding: 2px 0;">
              <span style="font-size: 13px; color: #6B7B8D;">&#9993;&nbsp;</span>
              <a href="mailto:nick@lanebrief.com" style="font-size: 13px; color: #0D1F3C; text-decoration: none;">nick@lanebrief.com</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 2px 0;">
              <span style="font-size: 13px; color: #6B7B8D;">&#127758;&nbsp;</span>
              <a href="https://lanebrief.com" style="font-size: 13px; color: #00C2A8; text-decoration: none;">lanebrief.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
  `;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = getDb();

  // Target: signed up 23–25 hours ago with zero lanes saved
  const windowStart = new Date(Date.now() - 25 * 60 * 60 * 1000);
  const windowEnd = new Date(Date.now() - 23 * 60 * 60 * 1000);

  // Left join lanes — isNull(lanes.id) means no lanes exist for that user
  const abandoned = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .leftJoin(lanes, eq(lanes.userId, users.id))
    .where(
      and(
        gte(users.createdAt, windowStart),
        lte(users.createdAt, windowEnd),
        isNull(lanes.id)
      )
    );

  if (abandoned.length === 0) {
    console.log("[onboarding-reminder] No abandoned users in window.");
    return Response.json({ ok: true, sent: 0 });
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[onboarding-reminder] RESEND_API_KEY not set — skipping sends.");
    console.log(`[onboarding-reminder] Would have emailed: ${abandoned.map((u) => u.email).join(", ")}`);
    return Response.json({ ok: true, sent: 0, dryRun: true, count: abandoned.length });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;

  for (const user of abandoned) {
    try {
      await resend.emails.send({
        from: FROM,
        replyTo: "nick@lanebrief.com",
        to: user.email,
        subject: "Your freight intelligence is one step away",
        html: buildAbandonedOnboardingEmail(user.email),
      });
      sent++;
      console.log(`[onboarding-reminder] Sent to ${user.email}`);
    } catch (err) {
      console.error(`[onboarding-reminder] Failed to send to ${user.email}:`, err);
    }
  }

  console.log(`[onboarding-reminder] Done. Sent ${sent}/${abandoned.length} reminders.`);
  return Response.json({ ok: true, sent, total: abandoned.length });
}
