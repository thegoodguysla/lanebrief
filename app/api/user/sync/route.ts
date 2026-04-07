import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { users, onboardingEmails, affiliates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { Resend } from "resend";
import { notifyNewSignup } from "@/lib/notify";

const FROM = "Nick Taylor <nick@email.lanebrief.com>";
const REPLY_TO = "nick@lanebrief.com";

function getFirstName(email: string): string {
  const local = email.split("@")[0].split(".")[0].split("+")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

async function sendEmail1(userId: string, email: string) {
  if (!process.env.RESEND_API_KEY) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const firstName = getFirstName(email);

  const html = `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
<p>Hey ${firstName},</p>
<p>Welcome to LaneBrief.</p>
<p>One thing to do right now: add your top 3 lanes.</p>
<p>That is all it takes to get your first rate brief. Takes 2 minutes.</p>
<p><a href="https://lanebrief.com/portfolio" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 10px 24px; border-radius: 6px;">Add your lanes →</a></p>
<p style="font-size: 13px; color: #6B7B8D;">If you run US-Mexico or US-Canada freight, add those first — we track tariff exposure in real time.</p>
<p>Reply to this email if you have any questions. I read every one.</p>
<p>— Nick</p>
</div>`;

  try {
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: email,
      subject: "Welcome to LaneBrief — start here",
      html,
    });

    const db = getDb();
    await db.insert(onboardingEmails).values({
      id: randomUUID(),
      userId,
      emailNumber: 1,
    });
  } catch (err) {
    console.error("[user/sync] Failed to send welcome email:", err);
  }
}

// Called after sign-in/sign-up to upsert the Clerk user into our DB
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const email =
    clerkUser.emailAddresses[0]?.emailAddress ?? "";

  const db = getDb();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (existing.length > 0) {
    return Response.json({ user: existing[0] });
  }

  // Read affiliate ref cookie set by proxy.ts on first visit
  const cookieStore = await cookies();
  const refCode = cookieStore.get("lb_ref")?.value ?? null;

  // Verify the ref code belongs to an approved affiliate
  let verifiedAffiliateCode: string | null = null;
  if (refCode) {
    const [affiliate] = await db
      .select({ code: affiliates.code })
      .from(affiliates)
      .where(eq(affiliates.code, refCode))
      .limit(1);
    if (affiliate) verifiedAffiliateCode = affiliate.code;
  }

  const [newUser] = await db
    .insert(users)
    .values({
      id: randomUUID(),
      clerkId: userId,
      email,
      alertOptIn: false,
      affiliateCode: verifiedAffiliateCode,
    })
    .returning();

  // Fire-and-forget: send Email 1 of onboarding drip + owner notification
  sendEmail1(newUser.id, newUser.email);
  notifyNewSignup({ email: newUser.email, source: verifiedAffiliateCode ? `affiliate:${verifiedAffiliateCode}` : refCode });

  return Response.json({ user: newUser }, { status: 201 });
}
