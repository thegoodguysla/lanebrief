import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

// Signature 1 — Nick (nick@lanebrief.com)
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

// Signature 2 — Intel (intel@lanebrief.com)
const SIGNATURE_INTEL = `
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
      <span style="font-size: 16px; font-weight: bold; color: #0D1F3C;">LaneBrief Intelligence</span>
      <span style="font-size: 13px; color: #6B7B8D; margin-left: 8px;">Automated Freight Reports</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 2px 0 10px 0;">
      <span style="font-size: 15px; font-weight: bold; color: #00C2A8;">&#9658;</span>
      <span style="font-size: 15px; font-weight: bold; color: #0D1F3C; margin-left: 4px;">LaneBrief</span>
      <span style="font-size: 11px; color: #6B7B8D; margin-left: 8px;">Lane-Level Intelligence. Delivered Daily.</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 0 0 4px 0;">
      <span style="font-size: 12px; color: #6B7B8D; font-style: italic;">This report is generated automatically by LaneBrief. Reply to reach our team.</span>
    </td>
  </tr>
  <tr>
    <td style="padding: 0 0 12px 0;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 2px 0;">
            <span style="font-size: 13px; color: #6B7B8D;">&#9993;&nbsp;</span>
            <a href="mailto:intel@lanebrief.com" style="font-size: 13px; color: #0D1F3C; text-decoration: none;">intel@lanebrief.com</a>
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

// Placeholders — replace before go-live
const CALENDLY_URL = "https://calendly.com/lanebrief/15min";
const SAMPLE_PDF_URL = "https://lanebrief.com/sample-brief.pdf";

function buildSignupEmail(name: string): string {
  const firstName = name.split(" ")[0];
  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
  <p>Hi ${firstName},</p>

  <p>Thanks for reaching out — you landed here because you want better visibility
  into what's actually happening on your lanes. That's exactly what LaneBrief
  is built for.</p>

  <p>Here's what happens next:</p>
  <ol>
    <li>I'll send you a sample intelligence brief for a lane you care about</li>
    <li>If it's useful, we can talk about setting up weekly coverage for your book</li>
    <li>No commitment — if it doesn't save you time or margin, it's not worth your money</li>
  </ol>

  <p>Reply with the top 2-3 lanes you'd want covered (e.g., "DAL to CHI",
  "LAX to DFW", "ATL to NYC") and I'll pull the current data.</p>

  <p>If you'd rather jump straight to a call:<br/>
  <a href="${CALENDLY_URL}" style="color: #00C2A8;">Schedule 15 minutes</a></p>

  <p>— Nick</p>

  ${SIGNATURE_NICK}
</div>
  `;
}

function buildSampleRequestEmail(name: string, lanes?: string): string {
  const firstName = name.split(" ")[0];
  const lanesText = lanes || "your requested lanes";
  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
  <p>Hi ${firstName},</p>

  <p>Got your request. We're pulling current data on ${lanesText} now.</p>

  <p>You'll receive your sample intelligence brief within 24 hours.</p>

  <p><strong>What's in it:</strong></p>
  <ul>
    <li>Spot rate trend (7-day + 4-week moving avg)</li>
    <li>Capacity signal (truck availability index vs. historical)</li>
    <li>Market inflection flags (early signals of rate compression or spike)</li>
    <li>What it means for your book</li>
  </ul>

  <p>If you have specific lanes you want prioritized, just reply to this email.</p>

  <p>— The LaneBrief Team</p>

  ${SIGNATURE_INTEL}
</div>
  `;
}

type ContactPayload = {
  name: string;
  email: string;
  company?: string;
  lanes?: string;
  type: "signup" | "sample_request";
};

export async function POST(request: Request) {
  let body: ContactPayload;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, company: _company, lanes, type } = body;

  if (!name || !email || !type) {
    return Response.json(
      { error: "Missing required fields: name, email, type" },
      { status: 400 }
    );
  }

  if (type !== "signup" && type !== "sample_request") {
    return Response.json(
      { error: 'type must be "signup" or "sample_request"' },
      { status: 400 }
    );
  }

  // Always log the lead so it's captured in Vercel function logs
  console.log(`[LEAD] type=${type} name="${name}" email="${email}" lanes="${lanes || ""}"`)

  if (!process.env.RESEND_API_KEY) {
    console.warn("[LEAD] RESEND_API_KEY not set — lead logged but no email sent");
    return Response.json({ success: true, emailSent: false });
  }

  // Use verified custom domain when available, fall back to Resend default
  const domainVerified = process.env.RESEND_DOMAIN_VERIFIED === "true";
  const fromNick = domainVerified ? "nick@lanebrief.com" : "LaneBrief <onboarding@resend.dev>";
  const fromIntel = domainVerified ? "intel@lanebrief.com" : "LaneBrief Intel <onboarding@resend.dev>";

  try {
    if (type === "signup") {
      await getResend().emails.send({
        from: fromNick,
        replyTo: "nick@lanebrief.com",
        to: email,
        subject: "Your lane intelligence is ready — next step inside",
        html: buildSignupEmail(name),
      });
    } else {
      await getResend().emails.send({
        from: fromIntel,
        replyTo: "nick@lanebrief.com",
        to: email,
        subject: "Your LaneBrief sample is being prepared",
        html: buildSampleRequestEmail(name, lanes),
      });
    }

    return Response.json({ success: true, emailSent: true });
  } catch (err) {
    console.error("Resend error:", err);
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }
}
