import { getDb } from "@/lib/db";
import { users, lanes, briefs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateText } from "ai";
import { Resend } from "resend";
import { randomUUID } from "crypto";

// POST /api/admin/onboard-pilot
// White-glove pilot onboarding trigger.
// Nick calls this before a demo call to pre-load the pilot's inbox with their first brief.
// Works for both existing users (creates lanes + sends email) and prospects (sends brief
// preview email with sign-up CTA — no DB record required).
//
// Auth: Authorization: Bearer <CRON_SECRET>
// Body: { email: string, lanes: [{origin, destination, equipment?}] }

const FROM = "LaneBrief Intel <intel@email.lanebrief.com>";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

type LaneInput = { origin: string; destination: string; equipment?: string };

type GeneratedBrief = {
  origin: string;
  destination: string;
  equipment: string;
  title: string;
  content: string;
};

async function generateBriefText(
  origin: string,
  destination: string,
  equipment: string
): Promise<string> {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();

  const { text } = await generateText({
    model: "anthropic/claude-haiku-4.5",
    prompt: `You are a freight market analyst. Write a concise intelligence brief for an independent freight broker.

Lane: ${origin} → ${destination}
Equipment: ${equipment.replace(/_/g, " ")}
Period: ${month} ${year}

Cover:
1. Current market conditions and capacity signal (tight/normal/loose)
2. AI-estimated spot rate range (clearly labeled as AI-estimated)
3. Key seasonal factor affecting this lane right now
4. One actionable insight or risk for this month

Keep it to 3-4 short paragraphs. End with: "All rate estimates are AI-generated and not a substitute for live market data."

Format as clean plain text (no markdown headers).`,
    maxOutputTokens: 512,
  });

  return text.trim();
}

function buildWelcomeEmailHtml(
  recipientEmail: string,
  generatedBriefs: GeneratedBrief[],
  isNewPilot: boolean
): string {
  const briefSections = generatedBriefs
    .map(
      (b, i) => `
<div style="margin-top: ${i === 0 ? "0" : "24px"}; padding: 20px 24px; background-color: #F8FAFC; border-radius: 8px; border-left: 3px solid #00C2A8;">
  <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: bold; color: #00C2A8; text-transform: uppercase; letter-spacing: 0.05em;">
    Lane ${i + 1} — ${b.origin} → ${b.destination} (${b.equipment.replace(/_/g, " ")})
  </p>
  <p style="margin: 0 0 10px 0; font-size: 15px; font-weight: bold; color: #0D1F3C;">${b.title}</p>
  <p style="margin: 0; font-size: 13px; color: #4A5568; line-height: 1.7; white-space: pre-wrap;">${b.content}</p>
</div>`
    )
    .join("");

  const ctaSection = isNewPilot
    ? `
<div style="margin-top: 28px; text-align: center;">
  <p style="margin: 0 0 12px 0; font-size: 14px; color: #4A5568;">
    Want to see this on your personal dashboard, set custom rate alerts, and get weekly updates?
  </p>
  <a href="https://lanebrief.com/sign-up" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 6px;">
    Create your free account →
  </a>
  <p style="margin: 12px 0 0 0; font-size: 12px; color: #A0AEC0;">No credit card required. Your lanes will be waiting.</p>
</div>`
    : `
<div style="margin-top: 28px; text-align: center;">
  <a href="https://lanebrief.com/dashboard" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 6px;">
    View your dashboard →
  </a>
  <p style="margin: 12px 0 0 0; font-size: 12px; color: #A0AEC0;">
    Rate alerts are set at 5% threshold on all your lanes.
  </p>
</div>`;

  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
  <div style="background: linear-gradient(135deg, #0D1F3C 0%, #1a3a5c 100%); padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #FFFFFF;">
      <span style="color: #00C2A8;">▶</span> Your First LaneBrief Is Ready
    </p>
    <p style="margin: 4px 0 0 0; font-size: 13px; color: #A0AEC0;">
      AI-powered freight intelligence for your lanes
    </p>
  </div>

  <div style="padding: 28px 0 0 0;">
    <p style="margin: 0 0 20px 0; font-size: 15px; color: #0D1F3C;">
      Here's your personalized freight intelligence brief — this is exactly what you'll receive weekly, tailored to your specific lanes.
    </p>

    ${briefSections}

    <div style="margin-top: 20px; padding: 14px 18px; background-color: #FFF5F0; border-radius: 8px; border-left: 3px solid #F97316;">
      <p style="margin: 0; font-size: 13px; color: #4A5568;">
        <strong>What you get weekly:</strong> Rate movement alerts (5% threshold), market capacity signals, tariff-impact flags, and actionable intel — all automated.
      </p>
    </div>

    ${ctaSection}
  </div>

  <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #E2F5F2;">
    <p style="margin: 0; font-size: 16px; font-weight: bold; color: #0D1F3C;">LaneBrief Intelligence</p>
    <p style="margin: 4px 0 0 0; font-size: 12px; color: #6B7B8D;">
      <a href="mailto:intel@lanebrief.com" style="color: #0D1F3C; text-decoration: none;">intel@lanebrief.com</a>
      &nbsp;·&nbsp;
      <a href="https://lanebrief.com" style="color: #00C2A8; text-decoration: none;">lanebrief.com</a>
    </p>
  </div>
</div>`;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { email?: string; lanes?: LaneInput[] };
  const { email, lanes: laneInputs } = body;

  if (!email || !laneInputs || laneInputs.length === 0) {
    return Response.json({ error: "email and lanes are required" }, { status: 400 });
  }

  const normalizedLanes = laneInputs.slice(0, 3).map((l) => ({
    origin: l.origin?.trim(),
    destination: l.destination?.trim(),
    equipment: l.equipment?.trim() ?? "dry_van",
  }));

  const invalid = normalizedLanes.find((l) => !l.origin || !l.destination);
  if (invalid) {
    return Response.json({ error: "Each lane requires origin and destination" }, { status: 400 });
  }

  // Check if this pilot already has a DB user
  const db = getDb();
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Generate briefs for all lanes (AI)
  const generatedBriefs: GeneratedBrief[] = [];
  for (const lane of normalizedLanes) {
    const now = new Date();
    const month = now.toLocaleString("en-US", { month: "long" });
    const year = now.getFullYear();
    const content = await generateBriefText(lane.origin, lane.destination, lane.equipment);
    generatedBriefs.push({
      origin: lane.origin,
      destination: lane.destination,
      equipment: lane.equipment,
      title: `${lane.origin} → ${lane.destination} — ${month} ${year}`,
      content,
    });
  }

  let lanesCreated = 0;

  if (existingUser) {
    // Create lanes in DB with 5% auto-alert threshold
    for (const brief of generatedBriefs) {
      try {
        const [savedLane] = await db
          .insert(lanes)
          .values({
            id: randomUUID(),
            userId: existingUser.id,
            origin: brief.origin,
            destination: brief.destination,
            equipment: brief.equipment,
            alertThresholdPct: 5,
          })
          .onConflictDoNothing()
          .returning();

        if (savedLane) {
          // Persist the brief too
          await db.insert(briefs).values({
            id: randomUUID(),
            userId: existingUser.id,
            laneId: savedLane.id,
            title: brief.title,
            content: brief.content,
            version: 1,
          });
          lanesCreated++;
        }
      } catch {
        // Lane already exists — skip
      }
    }

    // Enable alert opt-in
    await db
      .update(users)
      .set({ alertOptIn: true, updatedAt: new Date() })
      .where(eq(users.id, existingUser.id));
  }

  // Send welcome email
  const resend = getResend();
  const laneLabel = normalizedLanes.map((l) => `${l.origin} → ${l.destination}`).join(", ");
  await resend.emails.send({
    from: FROM,
    replyTo: "intel@lanebrief.com",
    to: email,
    subject: `Your LaneBrief is ready — ${generatedBriefs[0].origin} → ${generatedBriefs[0].destination}`,
    html: buildWelcomeEmailHtml(email, generatedBriefs, !existingUser),
  });

  return Response.json({
    ok: true,
    userFound: !!existingUser,
    lanesCreated,
    briefsGenerated: generatedBriefs.length,
    emailSent: email,
    lanes: laneLabel,
  });
}
