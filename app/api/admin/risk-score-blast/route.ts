import { getDb } from "@/lib/db";
import { users, lanes } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { Resend } from "resend";

// POST /api/admin/risk-score-blast
// One-time blast: Carrier Payment Risk Score feature launch announcement
// Protected by CRON_SECRET. Send once — do not run more than once in production.

const FROM = "Nick, LaneBrief <nick@email.lanebrief.com>";

function buildRiskScoreHtml(firstName: string): string {
  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.7; color: #0D1F3C; max-width: 600px;">
  <div style="background: linear-gradient(135deg, #0D1F3C 0%, #1a3a5c 100%); padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #FFFFFF;">
      <span style="color: #00C2A8;">▶</span> LaneBrief
    </p>
    <p style="margin: 4px 0 0 0; font-size: 13px; color: #A0AEC0;">New: Flag risky carriers before you tender a load</p>
  </div>

  <div style="border: 1px solid #E2F5F2; border-top: none; border-radius: 0 0 8px 8px; padding: 28px 28px 24px;">
    <p style="margin: 0 0 16px 0;">Hey ${firstName},</p>

    <p style="margin: 0 0 16px 0;">
      Double-brokering and carrier fraud are at record levels in 2026.
    </p>

    <p style="margin: 0 0 16px 0;">
      LaneBrief now scores every carrier you look up — before you tender the load.
    </p>

    <div style="background-color: #F0FDFA; border-radius: 8px; padding: 20px 24px; margin: 0 0 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #0D1F3C;">The Payment Risk Score combines:</p>
      <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #4A5568;">
        <li style="margin-bottom: 8px;">FMCSA complaint history</li>
        <li style="margin-bottom: 8px;">Payment dispute signals</li>
        <li style="margin-bottom: 8px;">Authority age and reverification flags</li>
        <li style="margin-bottom: 8px;">Cross-referenced fraud pattern database</li>
      </ul>
    </div>

    <div style="background-color: #FFF5F5; border-radius: 8px; padding: 16px 20px; margin: 0 0 20px 0; border-left: 3px solid #E53E3E;">
      <p style="margin: 0; font-size: 14px; color: #4A5568;">
        You get: <strong style="color: #0D1F3C;">Low / Medium / High risk</strong>, with a plain-English reason.
      </p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #4A5568;">
        One screen. One score. Book or skip.
      </p>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="https://lanebrief.com/carriers"
         style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 6px;">
        Look up a carrier on LaneBrief →
      </a>
    </div>

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
        replyTo: "nick@lanebrief.com",
        to: user.email,
        subject: "New: Flag risky carriers before you tender a load",
        html: buildRiskScoreHtml(firstName),
      });
      sent++;
    } catch (err) {
      console.error(`[risk-score-blast] Failed to send to ${user.email}:`, err);
      failed.push(user.email);
    }
  }

  console.log(`[risk-score-blast] Done. Sent ${sent}/${userRows.length}. Failed: ${failed.length}`);

  return Response.json({
    ok: true,
    totalUsers: userRows.length,
    sent,
    failed,
  });
}
