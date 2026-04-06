import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, lanes, briefs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Resend } from "resend";

// POST /api/user/welcome-email
// Called by the onboarding wizard after lanes are saved and first brief is generated.
// Sends a welcome email with the brief content and a link to the dashboard.
// Fire-and-forget from client — idempotent (won't crash if brief not ready yet).

const FROM = "LaneBrief Intel <intel@email.lanebrief.com>";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

function buildWelcomeEmailHtml(
  userLanes: { origin: string; destination: string; equipment: string }[],
  firstBriefContent: string | null,
  firstBriefTitle: string | null
): string {
  const briefSection = firstBriefContent
    ? `
<div style="margin-top: 20px; padding: 20px 24px; background-color: #F8FAFC; border-radius: 8px; border-left: 3px solid #00C2A8;">
  <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: bold; color: #00C2A8; text-transform: uppercase; letter-spacing: 0.05em;">
    Your First Intelligence Brief
  </p>
  ${firstBriefTitle ? `<p style="margin: 0 0 10px 0; font-size: 15px; font-weight: bold; color: #0D1F3C;">${firstBriefTitle}</p>` : ""}
  <p style="margin: 0; font-size: 13px; color: #4A5568; line-height: 1.7; white-space: pre-wrap;">${firstBriefContent.slice(0, 1200)}${firstBriefContent.length > 1200 ? "\n\n[Full brief on your dashboard →]" : ""}</p>
</div>`
    : `
<div style="margin-top: 20px; padding: 16px 20px; background-color: #F8FAFC; border-radius: 8px; border-left: 3px solid #00C2A8;">
  <p style="margin: 0; font-size: 13px; color: #4A5568;">
    Your first brief is being generated — it'll appear on your dashboard within 60 seconds.
  </p>
</div>`;

  const laneList = userLanes
    .map(
      (l) =>
        `<li style="margin-bottom: 4px; font-size: 13px; color: #4A5568;">
      <strong>${l.origin} → ${l.destination}</strong>
      <span style="color: #A0AEC0; text-transform: capitalize;"> · ${l.equipment.replace(/_/g, " ")}</span>
    </li>`
    )
    .join("");

  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
  <div style="background: linear-gradient(135deg, #0D1F3C 0%, #1a3a5c 100%); padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #FFFFFF;">
      <span style="color: #00C2A8;">▶</span> Welcome to LaneBrief
    </p>
    <p style="margin: 4px 0 0 0; font-size: 13px; color: #A0AEC0;">
      Your freight intelligence is ready
    </p>
  </div>

  <div style="padding: 28px 0 0 0;">
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #0D1F3C;">
      You're set up. Here's what LaneBrief is now tracking for you:
    </p>

    <ul style="margin: 0 0 20px 0; padding-left: 20px;">
      ${laneList}
    </ul>

    <div style="padding: 14px 18px; background-color: #F0FDF4; border-radius: 8px; border-left: 3px solid #16A34A;">
      <p style="margin: 0; font-size: 13px; color: #4A5568;">
        <strong>Rate alerts activated:</strong> You'll get notified when any of your lanes move more than 5%. Adjust thresholds anytime on your dashboard.
      </p>
    </div>

    ${briefSection}

    <div style="margin-top: 24px; padding: 14px 18px; background-color: #FFF5F0; border-radius: 8px; border-left: 3px solid #F97316;">
      <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: bold; color: #0D1F3C;">What happens next</p>
      <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #4A5568;">
        <li style="margin-bottom: 3px;">Weekly rate digests every Monday morning</li>
        <li style="margin-bottom: 3px;">Instant alerts when rates cross your 5% threshold</li>
        <li>Tariff-impact flags for US-MX and US-CA lanes</li>
      </ul>
    </div>

    <div style="margin-top: 28px; text-align: center;">
      <a href="https://lanebrief.com/dashboard" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 6px;">
        View your dashboard →
      </a>
    </div>
  </div>

  <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #E2F5F2;">
    <p style="margin: 0; font-size: 16px; font-weight: bold; color: #0D1F3C;">LaneBrief Intelligence</p>
    <p style="margin: 4px 0 0 0; font-size: 12px; color: #6B7B8D;">
      <a href="mailto:intel@lanebrief.com" style="color: #0D1F3C; text-decoration: none;">intel@lanebrief.com</a>
      &nbsp;·&nbsp;
      <a href="https://lanebrief.com" style="color: #00C2A8; text-decoration: none;">lanebrief.com</a>
    </p>
    <p style="margin: 8px 0 0 0; font-size: 11px; color: #A0AEC0;">
      You received this because you just set up LaneBrief.
      <a href="https://lanebrief.com/dashboard" style="color: #A0AEC0;">Manage alerts</a>
    </p>
  </div>
</div>`;
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  // Get user's lanes
  const userLanes = await db.select().from(lanes).where(eq(lanes.userId, user.id));
  if (userLanes.length === 0) {
    return Response.json({ ok: false, reason: "No lanes found" });
  }

  // Get most recent brief for primary lane
  const [latestBrief] = await db
    .select()
    .from(briefs)
    .where(eq(briefs.userId, user.id))
    .orderBy(desc(briefs.generatedAt))
    .limit(1);

  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    replyTo: "intel@lanebrief.com",
    to: user.email,
    subject: `Your LaneBrief is ready — ${userLanes[0].origin} → ${userLanes[0].destination}`,
    html: buildWelcomeEmailHtml(
      userLanes.map((l) => ({ origin: l.origin, destination: l.destination, equipment: l.equipment })),
      latestBrief?.content ?? null,
      latestBrief?.title ?? null
    ),
  });

  return Response.json({ ok: true, emailSent: user.email });
}
