import { getDb } from "@/lib/db";
import { demoBookings } from "@/lib/db/schema";
import { and, eq, gte, lte, isNull } from "drizzle-orm";
import { Resend } from "resend";

// Vercel Cron: daily at 9am ET (14:00 UTC)
// Finds bookings made ~24 hours ago and sends a day-before reminder.
// "Day-before" is approximated: since we don't get the actual calendar slot back
// from Google Calendar, we treat the booking as "demo is tomorrow" if it was
// submitted 20–28 hours ago.

const FROM = "Nick Taylor <nick@email.lanebrief.com>";

const DEMO_BOOKING_URL = "https://calendar.app.google/d5reMPsxnBWAguRC6";

const SIGNATURE_NICK = `
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
`;

function buildDayBeforeReminderEmail(name: string): string {
  const firstName = name.split(" ")[0];
  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
  <p>Hi ${firstName},</p>

  <p>Quick reminder — your LaneBrief demo is tomorrow.</p>

  <p>LaneBrief gives you live rate intelligence on your lanes: real-time rate lookup, tariff-impact flags, and carrier scores. The demo is 30 minutes and we'll pull live data on a lane you actually run.</p>

  <p><strong>One prep ask:</strong> have one lane you quote regularly (origin/destination pair) ready to go. I'll run a live rate on it during the call.</p>

  <p>Need to reschedule? Reach out directly at <a href="mailto:nick@lanebrief.com" style="color: #00C2A8;">nick@lanebrief.com</a> or pick a new time below:</p>

  <p>
    <a href="${DEMO_BOOKING_URL}" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 10px 24px; border-radius: 6px;">
      Reschedule →
    </a>
  </p>

  <p>See you tomorrow,</p>
  <p>— Nick</p>

  ${SIGNATURE_NICK}
</div>
  `;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = getDb();

  // Target: bookings submitted 20–28 hours ago with no reminder sent yet
  const windowStart = new Date(Date.now() - 28 * 60 * 60 * 1000);
  const windowEnd = new Date(Date.now() - 20 * 60 * 60 * 1000);

  const pending = await db
    .select({
      id: demoBookings.id,
      name: demoBookings.name,
      email: demoBookings.email,
    })
    .from(demoBookings)
    .where(
      and(
        gte(demoBookings.bookedAt, windowStart),
        lte(demoBookings.bookedAt, windowEnd),
        isNull(demoBookings.reminderSentAt)
      )
    );

  if (pending.length === 0) {
    console.log("[demo-reminder] No pending reminders in window.");
    return Response.json({ ok: true, sent: 0 });
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[demo-reminder] RESEND_API_KEY not set — skipping sends.");
    console.log(`[demo-reminder] Would have emailed: ${pending.map((b) => b.email).join(", ")}`);
    return Response.json({ ok: true, sent: 0, dryRun: true, count: pending.length });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;

  for (const booking of pending) {
    try {
      await resend.emails.send({
        from: FROM,
        replyTo: "nick@lanebrief.com",
        to: booking.email,
        subject: "Quick reminder — LaneBrief demo tomorrow",
        html: buildDayBeforeReminderEmail(booking.name),
      });

      // Mark reminder sent
      await db
        .update(demoBookings)
        .set({ reminderSentAt: new Date() })
        .where(eq(demoBookings.id, booking.id));

      sent++;
      console.log(`[demo-reminder] Sent to ${booking.email}`);
    } catch (err) {
      console.error(`[demo-reminder] Failed to send to ${booking.email}:`, err);
    }
  }

  console.log(`[demo-reminder] Done. Sent ${sent}/${pending.length} reminders.`);
  return Response.json({ ok: true, sent, total: pending.length });
}
