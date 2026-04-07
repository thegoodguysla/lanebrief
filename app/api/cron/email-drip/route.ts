import { getDb } from "@/lib/db";
import {
  users,
  lanes,
  rateSnapshots,
  onboardingEmails,
} from "@/lib/db/schema";
import { and, eq, inArray, notInArray, lte, gte, sql } from "drizzle-orm";
import { Resend } from "resend";
import { randomUUID } from "crypto";

// Vercel Cron: daily at 3pm UTC (10am ET)
// Sends emails 2–5 of the onboarding drip sequence based on days since signup.
// Email 1 is sent immediately at signup in /api/user/sync.

const FROM = "Nick Taylor <nick@email.lanebrief.com>";
const REPLY_TO = "nick@lanebrief.com";

function getFirstName(email: string): string {
  const local = email.split("@")[0].split(".")[0].split("+")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function isTariffLane(origin: string, destination: string): boolean {
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  return (
    o.includes("MX") ||
    d.includes("MX") ||
    o.includes("MEXICO") ||
    d.includes("MEXICO") ||
    o.includes("CA") ||
    d.includes("CA") ||
    o.includes("CANADA") ||
    d.includes("CANADA")
  );
}

function buildEmail2Html(
  firstName: string,
  userLanes: { origin: string; destination: string; equipment: string }[],
  snapshots: { origin: string; destination: string; deltaPct: number }[]
): string {
  const hasLanes = userLanes.length > 0;

  if (!hasLanes) {
    return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
<p>Hey ${firstName},</p>
<p>You haven't added your lanes yet.</p>
<p>It takes 2 minutes — and once you do, LaneBrief starts tracking rate movements, tariff exposure, and capacity signals on your specific lanes.</p>
<p><a href="https://lanebrief.com/dashboard" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 10px 24px; border-radius: 6px;">Add your lanes now →</a></p>
<p>— Nick</p>
</div>`;
  }

  const laneList = userLanes
    .map((l) => `${l.origin} → ${l.destination} (${l.equipment.replace(/_/g, " ")})`)
    .join("\n");

  const tariffCount = userLanes.filter((l) =>
    isTariffLane(l.origin, l.destination)
  ).length;

  const avgChange =
    snapshots.length > 0
      ? (
          snapshots.reduce((sum, s) => sum + Math.abs(s.deltaPct), 0) /
          snapshots.length
        ).toFixed(1)
      : null;

  const topSnapshot = snapshots.sort(
    (a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct)
  )[0];

  return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
<p>Hey ${firstName},</p>
<p>Your first rate brief is ready.</p>
<p>Here is what we are tracking for you:</p>
<pre style="font-size: 13px; color: #4A5568; background: #F8FAFC; padding: 12px 16px; border-radius: 6px; white-space: pre-wrap;">${laneList}</pre>
${
  avgChange || topSnapshot || tariffCount > 0
    ? `<p>This week's highlights:</p>
<ul style="font-size: 14px; color: #4A5568;">
  ${avgChange ? `<li>Spot rates moved ${avgChange}% on your lanes</li>` : ""}
  ${topSnapshot ? `<li>${topSnapshot.origin} → ${topSnapshot.destination} had the biggest shift: ${Math.abs(topSnapshot.deltaPct).toFixed(1)}%</li>` : ""}
  ${tariffCount > 0 ? `<li>${tariffCount} of your lanes ${tariffCount === 1 ? "has" : "have"} tariff exposure</li>` : ""}
</ul>`
    : ""
}
<p><a href="https://lanebrief.com/portfolio" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 10px 24px; border-radius: 6px;">See your full brief →</a></p>
<p style="font-size: 13px; color: #6B7B8D;">Quick tip: set a rate alert on your highest-volume lane. You will get an email the moment rates move beyond your threshold.</p>
<p>— Nick</p>
</div>`;
}

function buildEmail3Html(
  firstName: string,
  laneCount: number,
  alertCount: number,
  topLane: { origin: string; destination: string; deltaPct: number } | null,
  trialDaysLeft: number | null,
  daysSinceSignup: number
): string {
  const estimatedChecks = laneCount * daysSinceSignup * 2;
  const timeSaved = Math.max(1, Math.round(estimatedChecks * 0.05));
  const dollarEstimate =
    topLane ? Math.round(Math.abs(topLane.deltaPct) * 0.01 * 2.5 * 500) : null;

  return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
<p>Hey ${firstName},</p>
<p>You've been on LaneBrief for ${daysSinceSignup} days. Here is your impact so far:</p>
<ul style="font-size: 14px; color: #4A5568;">
  <li>Lanes tracked: ${laneCount}</li>
  <li>Rate checks saved: ~${estimatedChecks} manual lookups</li>
  <li>Alerts triggered: ${alertCount}</li>
  <li>Estimated time saved: ${timeSaved} hours</li>
</ul>
${
  topLane
    ? `<p>On your ${topLane.origin} → ${topLane.destination} lane: rates moved ${Math.abs(topLane.deltaPct).toFixed(1)}% this week.${dollarEstimate ? ` If you booked before the move, that's approximately $${dollarEstimate} per load.` : ""}</p>`
    : ""
}
${trialDaysLeft !== null ? `<p>You have <strong>${trialDaysLeft} days</strong> left on your Pro trial.</p>` : ""}
<p><a href="https://lanebrief.com/demo" style="color: #00C2A8; text-decoration: none;">Book a 20-min demo if you want to dig deeper →</a></p>
<p>— Nick</p>
</div>`;
}

function buildEmail4Html(firstName: string): string {
  return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
<p>Hey ${firstName},</p>
<p>Your Pro trial ends in 4 days.</p>
<p>After that, you keep:</p>
<ul style="font-size: 14px; color: #4A5568;">
  <li>Weekly Intelligence Report (free forever)</li>
  <li>Rate lookups on up to 3 lanes</li>
</ul>
<p>You lose:</p>
<ul style="font-size: 14px; color: #4A5568;">
  <li>Unlimited lanes</li>
  <li>7-day rate forecasts</li>
  <li>Carrier risk scores</li>
  <li>Rate alerts + tariff flags</li>
  <li>Lane Portfolio Intelligence View</li>
</ul>
<p>$79/month keeps everything. Annual plan is $699 (save $249).</p>
<p><a href="https://lanebrief.com/pricing" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 10px 24px; border-radius: 6px;">Upgrade to Pro →</a></p>
<p style="font-size: 13px; color: #6B7B8D;">Questions? Just reply here.</p>
<p>— Nick</p>
</div>`;
}

function buildEmail5Html(firstName: string): string {
  return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #0D1F3C; max-width: 600px;">
<p>Hey ${firstName},</p>
<p>Today is the last day of your Pro trial.</p>
<p>If LaneBrief has been useful — the forecasts, the risk scores, the portfolio view — now is the time to keep it.</p>
<p>$79/month. Cancel anytime. No contracts.</p>
<p><a href="https://lanebrief.com/pricing" style="display: inline-block; background-color: #00C2A8; color: #FFFFFF; font-size: 14px; font-weight: bold; text-decoration: none; padding: 10px 24px; border-radius: 6px;">Upgrade before midnight →</a></p>
<p style="font-size: 13px; color: #6B7B8D;">If the timing is not right, no problem. You stay on the free plan automatically. I'd love to know what would make Pro worth it for you — reply and tell me.</p>
<p>— Nick</p>
</div>`;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[email-drip] RESEND_API_KEY not set — skipping.");
    return Response.json({ ok: true, sent: 0, dryRun: true });
  }

  const db = getDb();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const now = new Date();

  // Email schedule: days since signup
  const emailSchedule: {
    emailNumber: number;
    minDays: number;
    maxDays: number;
    subject: (firstName: string, hasLanes: boolean) => string;
    skipIfPaid: boolean;
  }[] = [
    {
      emailNumber: 2,
      minDays: 1,
      maxDays: 3,
      subject: (firstName, hasLanes) =>
        hasLanes
          ? "Your lanes are being tracked"
          : "You haven't added your lanes yet",
      skipIfPaid: false,
    },
    {
      emailNumber: 3,
      minDays: 4,
      maxDays: 6,
      subject: () => "What LaneBrief saved you this week",
      skipIfPaid: false,
    },
    {
      emailNumber: 4,
      minDays: 9,
      maxDays: 11,
      subject: () => "4 days left on your LaneBrief Pro trial",
      skipIfPaid: true,
    },
    {
      emailNumber: 5,
      minDays: 12,
      maxDays: 14,
      subject: () => "Last day of your LaneBrief Pro trial",
      skipIfPaid: true,
    },
  ];

  let totalSent = 0;

  for (const schedule of emailSchedule) {
    const windowStart = new Date(
      now.getTime() - schedule.maxDays * 24 * 60 * 60 * 1000
    );
    const windowEnd = new Date(
      now.getTime() - schedule.minDays * 24 * 60 * 60 * 1000
    );

    // Find users in this signup window who haven't received this email yet
    const sentSubquery = db
      .select({ userId: onboardingEmails.userId })
      .from(onboardingEmails)
      .where(eq(onboardingEmails.emailNumber, schedule.emailNumber));

    let query = db
      .select()
      .from(users)
      .where(
        and(
          gte(users.createdAt, windowStart),
          lte(users.createdAt, windowEnd),
          notInArray(users.id, sentSubquery)
        )
      );

    const candidates = await query;

    for (const user of candidates) {
      // Skip paid users for emails 4 and 5
      if (
        schedule.skipIfPaid &&
        user.planTier === "pro" &&
        user.subscriptionStatus === "active"
      ) {
        console.log(
          `[email-drip] Skipping email ${schedule.emailNumber} for paid user ${user.email}`
        );
        continue;
      }

      const firstName = getFirstName(user.email);
      const daysSinceSignup = Math.floor(
        (now.getTime() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000)
      );

      // Get user's lanes
      const userLanes = await db
        .select()
        .from(lanes)
        .where(eq(lanes.userId, user.id));

      const hasLanes = userLanes.length > 0;

      // Get rate snapshots for user's lanes (last 7 days)
      const laneIds = userLanes.map((l) => l.id);
      const snapshots =
        laneIds.length > 0
          ? await db
              .select({
                origin: rateSnapshots.origin,
                destination: rateSnapshots.destination,
                deltaPct: rateSnapshots.deltaPct,
                laneId: rateSnapshots.laneId,
              })
              .from(rateSnapshots)
              .where(
                and(
                  inArray(rateSnapshots.laneId, laneIds),
                  gte(
                    rateSnapshots.generatedAt,
                    new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                  )
                )
              )
          : [];

      let html: string;
      const subject = schedule.subject(firstName, hasLanes);

      if (schedule.emailNumber === 2) {
        html = buildEmail2Html(firstName, userLanes, snapshots);
      } else if (schedule.emailNumber === 3) {
        const alertCount = snapshots.filter(
          (s) =>
            Math.abs(s.deltaPct) >=
            (userLanes.find((l) => l.id === s.laneId)?.alertThresholdPct ?? 5)
        ).length;

        const topSnapshot =
          snapshots.length > 0
            ? snapshots.sort(
                (a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct)
              )[0]
            : null;

        const trialDaysLeft =
          user.trialEndsAt
            ? Math.max(
                0,
                Math.ceil(
                  (user.trialEndsAt.getTime() - now.getTime()) /
                    (24 * 60 * 60 * 1000)
                )
              )
            : null;

        html = buildEmail3Html(
          firstName,
          userLanes.length,
          alertCount,
          topSnapshot,
          trialDaysLeft,
          daysSinceSignup
        );
      } else if (schedule.emailNumber === 4) {
        html = buildEmail4Html(firstName);
      } else {
        html = buildEmail5Html(firstName);
      }

      try {
        await resend.emails.send({
          from: FROM,
          replyTo: REPLY_TO,
          to: user.email,
          subject,
          html,
        });

        await db.insert(onboardingEmails).values({
          id: randomUUID(),
          userId: user.id,
          emailNumber: schedule.emailNumber,
        });

        totalSent++;
        console.log(
          `[email-drip] Sent email ${schedule.emailNumber} to ${user.email}`
        );
      } catch (err) {
        console.error(
          `[email-drip] Failed to send email ${schedule.emailNumber} to ${user.email}:`,
          err
        );
      }
    }
  }

  console.log(`[email-drip] Done. Sent ${totalSent} emails.`);
  return Response.json({ ok: true, sent: totalSent });
}
