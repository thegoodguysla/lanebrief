import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { and, eq, gte, lte, isNotNull } from "drizzle-orm";
import { Resend } from "resend";

// Vercel Cron: daily at 3pm ET (20:00 UTC)
// Sends annual upsell email to monthly Pro subscribers on Day 14 of their subscription.
// Day 14 = just after first renewal confirms they want to keep using LaneBrief.

const FROM = "Nick Taylor <nick@email.lanebrief.com>";
const REPLY_TO = "nick@lanebrief.com";

function getFirstName(email: string): string {
  const local = email.split("@")[0].split(".")[0].split("+")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function buildAnnualUpsellHtml(firstName: string): string {
  return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
<p>Hey ${firstName},</p>
<p>Thanks for being on LaneBrief Pro.</p>
<p>Quick offer: switch to annual billing and save $249.</p>
<table style="border-collapse: collapse; margin: 16px 0; font-size: 14px;">
  <tr>
    <td style="padding: 6px 16px 6px 0; color: #6B7B8D;">Monthly:</td>
    <td style="padding: 6px 0;">$79/mo = $948/year</td>
  </tr>
  <tr>
    <td style="padding: 6px 16px 6px 0; color: #6B7B8D;">Annual:</td>
    <td style="padding: 6px 0; font-weight: bold; color: #00C2A8;">$699/year — you save $249</td>
  </tr>
</table>
<p>Same everything. Just one payment instead of twelve.</p>
<p><a href="https://lanebrief.com/dashboard?tab=billing&upsell=annual" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 10px 24px; border-radius: 6px;">Switch to annual — save $249 →</a></p>
<p style="font-size: 13px; color: #6B7B8D;">Offer is always available in your billing settings if the timing is not right today.</p>
<p>— Nick</p>
</div>`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return Response.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const db = getDb();

  // Day 14 window: subscription created between 13 and 15 days ago
  const now = new Date();
  const day13Ago = new Date(now.getTime() - 13 * 86400_000);
  const day15Ago = new Date(now.getTime() - 15 * 86400_000);

  // Find monthly Pro subscribers in day 14 window who haven't received this email
  // We use subscriptionCreatedAt as a proxy for monthly (annual subscribers pay up front and rarely hit day 14 lookups)
  // annualUpsellSentAt is tracked via a separate column added below — for now filter by email tag
  const targets = await db
    .select({
      id: users.id,
      email: users.email,
      subscriptionId: users.subscriptionId,
      annualUpsellSentAt: users.annualUpsellSentAt,
    })
    .from(users)
    .where(
      and(
        eq(users.planTier, "pro"),
        eq(users.subscriptionStatus, "active"),
        isNotNull(users.subscriptionCreatedAt),
        gte(users.subscriptionCreatedAt, day15Ago),
        lte(users.subscriptionCreatedAt, day13Ago),
        // Only send once — skip if already sent
        // annualUpsellSentAt IS NULL (handled below with JS filter until column migrated)
      )
    );

  // Filter out users who already received the upsell email
  const eligible = targets.filter((u) => !u.annualUpsellSentAt);

  let sent = 0;
  for (const user of eligible) {
    try {
      const firstName = getFirstName(user.email);
      await resend.emails.send({
        from: FROM,
        replyTo: REPLY_TO,
        to: user.email,
        subject: "Save $249 on LaneBrief this year",
        html: buildAnnualUpsellHtml(firstName),
        tags: [{ name: "campaign", value: "annual_upsell" }],
      });

      // Mark as sent
      await db
        .update(users)
        .set({ annualUpsellSentAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, user.id));

      sent++;
      console.log(`[annual-upsell] Sent to ${user.email}`);
    } catch (err) {
      console.error(`[annual-upsell] Failed for ${user.email}:`, err);
    }
  }

  console.log(`[annual-upsell] Sent ${sent}/${eligible.length} upsell emails`);
  return Response.json({ sent, eligible: eligible.length });
}
