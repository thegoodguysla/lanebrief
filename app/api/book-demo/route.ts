import { Resend } from "resend";
import { getDb } from "@/lib/db";
import { demoBookings } from "@/lib/db/schema";
import { randomUUID } from "crypto";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

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

function buildDemoConfirmationEmail(name: string): string {
  const firstName = name.split(" ")[0];
  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
  <p>Hi ${firstName},</p>

  <p>Your demo is confirmed. LaneBrief gives freight brokers and shippers live rate intelligence on their lanes — including tariff-impact flags and carrier scores — so you're never caught off guard by a rate swing.</p>

  <p><strong>On the call, I'll show you:</strong></p>
  <ul>
    <li>Live rate lookup on a lane you run</li>
    <li>Tariff-impact flags (current and upcoming)</li>
    <li>Carrier score for that lane</li>
  </ul>

  <p><strong>One prep ask:</strong> bring one lane you quote regularly (origin/destination pair). I'll pull a live rate on it during our call so you see exactly what LaneBrief surfaces in real time.</p>

  <p>
    <a href="${DEMO_BOOKING_URL}" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 10px 24px; border-radius: 6px;">
      View / reschedule your booking →
    </a>
  </p>

  <p>See you soon,</p>
  <p>— Nick</p>

  ${SIGNATURE_NICK}
</div>
  `;
}

type BookDemoPayload = {
  name: string;
  email: string;
  utmSource?: string;
  utmCampaign?: string;
};

export async function POST(request: Request) {
  let body: BookDemoPayload;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, utmSource, utmCampaign } = body;

  if (!name || !email) {
    return Response.json({ error: "Missing required fields: name, email" }, { status: 400 });
  }

  // CRM log — captured in Vercel function logs, tagged for easy grep/export
  console.log(
    `[DEMO_BOOKING] name="${name}" email="${email}" utm_source="${utmSource || "direct"}" utm_campaign="${utmCampaign || ""}"`
  );

  // Persist booking for day-before reminder cron
  try {
    const db = getDb();
    await db.insert(demoBookings).values({
      id: randomUUID(),
      name,
      email,
      utmSource: utmSource ?? null,
      utmCampaign: utmCampaign ?? null,
    });
  } catch (err) {
    // Non-fatal — log and continue
    console.error("[DEMO_BOOKING] Failed to persist booking record:", err);
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[DEMO_BOOKING] RESEND_API_KEY not set — lead logged but no email sent");
    return Response.json({ success: true, emailSent: false });
  }

  try {
    await getResend().emails.send({
      from: "Nick Taylor <nick@email.lanebrief.com>",
      replyTo: "nick@lanebrief.com",
      to: email,
      subject: "Your LaneBrief demo is confirmed",
      html: buildDemoConfirmationEmail(name),
    });

    return Response.json({ success: true, emailSent: true });
  } catch (err) {
    console.error("Resend error:", err);
    // Don't fail the booking flow if email fails — booking intent is already logged
    return Response.json({ success: true, emailSent: false });
  }
}
