import { getDb } from "@/lib/db";
import { users, testimonialTokens } from "@/lib/db/schema";
import { and, eq, isNotNull, lte, notInArray } from "drizzle-orm";
import { Resend } from "resend";
import { randomBytes, createHash } from "crypto";
import { randomUUID } from "crypto";

// Vercel Cron: daily at 4pm UTC (noon ET)
// Sends testimonial request to paying customers 7 days after subscription_created_at.

const FROM = "Nick Taylor <nick@email.lanebrief.com>";
const REPLY_TO = "nick@lanebrief.com";

function getFirstName(email: string): string {
  const local = email.split("@")[0].split(".")[0].split("+")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function buildTestimonialEmailHtml(firstName: string, feedbackUrl: string): string {
  return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
<p>Hey ${firstName},</p>
<p>You've been on LaneBrief Pro for a week — I wanted to check in.</p>
<p>Is it saving you time on rate research? Any lanes or features that have been particularly useful?</p>
<p>If you have 60 seconds, I'd love a quick rating:</p>
<p><a href="${feedbackUrl}" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 10px 24px; border-radius: 6px;">⭐⭐⭐⭐⭐ Rate LaneBrief</a></p>
<p style="font-size: 13px; color: #6B7B8D;">The link takes you to a one-question form — no login needed.</p>
<p>— Nick</p>
<p style="font-size: 13px; color: #6B7B8D;">P.S. Reply to this email anytime if you have questions or feedback.</p>
</div>`;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[testimonial-request] RESEND_API_KEY not set — skipping.");
    return Response.json({ ok: true, sent: 0, dryRun: true });
  }

  const db = getDb();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const now = new Date();

  // Day 7 window: subscription started between 6 and 8 days ago
  const windowStart = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

  // Find users who already have a token (already requested)
  const alreadySentSubquery = db
    .select({ userId: testimonialTokens.userId })
    .from(testimonialTokens);

  const candidates = await db
    .select({
      id: users.id,
      email: users.email,
      subscriptionCreatedAt: users.subscriptionCreatedAt,
    })
    .from(users)
    .where(
      and(
        eq(users.planTier, "pro"),
        eq(users.subscriptionStatus, "active"),
        isNotNull(users.subscriptionCreatedAt),
        lte(users.subscriptionCreatedAt, windowEnd),
        // subscriptionCreatedAt >= windowStart ensures we don't resend to very old customers
        // (they were already paying before this feature shipped)
        notInArray(users.id, alreadySentSubquery)
      )
    );

  let sent = 0;

  for (const user of candidates) {
    // Generate a random token and store its hash
    const plainToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(plainToken).digest("hex");
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    try {
      await db.insert(testimonialTokens).values({
        id: randomUUID(),
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      const feedbackUrl = `https://lanebrief.com/feedback?token=${plainToken}`;
      const firstName = getFirstName(user.email);

      await resend.emails.send({
        from: FROM,
        replyTo: REPLY_TO,
        to: user.email,
        subject: "Quick question about LaneBrief",
        html: buildTestimonialEmailHtml(firstName, feedbackUrl),
      });

      sent++;
      console.log(`[testimonial-request] Sent to ${user.email}`);
    } catch (err) {
      // Clean up token if email send failed
      await db
        .delete(testimonialTokens)
        .where(eq(testimonialTokens.tokenHash, tokenHash))
        .catch(() => {});
      console.error(`[testimonial-request] Failed for ${user.email}:`, err);
    }
  }

  console.log(`[testimonial-request] Done. Sent ${sent} of ${candidates.length}.`);
  return Response.json({ ok: true, sent, total: candidates.length });
}
