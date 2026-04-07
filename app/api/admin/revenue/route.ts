import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, lanes, briefs, rateSnapshots, reportShares, demoBookings } from "@/lib/db/schema";
import { eq, and, gte, lt, isNotNull, count, sql } from "drizzle-orm";
import { stripe } from "@/lib/stripe";

const ADMIN_EMAILS = ["nick@lanebrief.com", "nick@thegoodguys.la"];

// GET /api/admin/revenue
// Returns revenue dashboard metrics — restricted to admin emails only.
export async function GET() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [callerUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (!callerUser || !ADMIN_EMAILS.includes(callerUser.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    allUsers,
    lanesRows,
    briefsRows,
    snapshotsRows,
    reportSharesRows,
    demoLeadsRows,
    signupsTodayRows,
    signupsWeekRows,
    signupsMonthRows,
    signupsByDayRows,
    proConvertedRows,
    trialsStartedRows,
  ] = await Promise.all([
    // All users with billing info
    db
      .select({
        id: users.id,
        email: users.email,
        planTier: users.planTier,
        subscriptionStatus: users.subscriptionStatus,
        subscriptionId: users.subscriptionId,
        stripeCustomerId: users.stripeCustomerId,
        trialEndsAt: users.trialEndsAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(sql`${users.createdAt} DESC`),

    // Lanes per user
    db
      .select({ userId: lanes.userId, laneCount: count() })
      .from(lanes)
      .groupBy(lanes.userId),

    // Total briefs count
    db.select({ value: count() }).from(briefs),

    // Total rate snapshots
    db.select({ value: count() }).from(rateSnapshots),

    // Report shares (viral referral)
    db
      .select({ total: count(), converted: sql<number>`SUM(CASE WHEN converted THEN 1 ELSE 0 END)` })
      .from(reportShares),

    // Demo/leads bookings total
    db.select({ value: count() }).from(demoBookings),

    // Signups today
    db.select({ value: count() }).from(users).where(gte(users.createdAt, startOfToday)),

    // Signups this week
    db.select({ value: count() }).from(users).where(gte(users.createdAt, startOfWeek)),

    // Signups this month
    db.select({ value: count() }).from(users).where(gte(users.createdAt, startOfMonth)),

    // Signups by day last 30 days (raw SQL for date grouping)
    db.execute(
      sql`SELECT DATE(created_at) AS date, COUNT(*) AS count FROM users WHERE created_at >= ${thirtyDaysAgo.toISOString()} GROUP BY DATE(created_at) ORDER BY date ASC`
    ),

    // Users who became pro in last 30 days (converted)
    db
      .select({ value: count() })
      .from(users)
      .where(
        and(
          eq(users.planTier, "pro"),
          gte(users.updatedAt, thirtyDaysAgo)
        )
      ),

    // Users who signed up with a trial in last 30 days
    db
      .select({ value: count() })
      .from(users)
      .where(
        and(
          isNotNull(users.trialEndsAt),
          gte(users.createdAt, thirtyDaysAgo)
        )
      ),
  ]);

  // Compute counts from allUsers
  const activePro = allUsers.filter(
    (u) => u.planTier === "pro" && (u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing")
  ).length;
  const activeFree = allUsers.filter((u) => u.planTier === "free").length;
  const activeTrials = allUsers.filter(
    (u) => u.trialEndsAt && new Date(u.trialEndsAt) > now
  ).length;

  // Build a map of lanesCount per userId
  const lanesMap = new Map<string, number>(lanesRows.map((r) => [r.userId, Number(r.laneCount)]));

  // Fetch MRR from Stripe
  let mrr = 0;
  try {
    const subscriptions = await stripe.subscriptions.list({
      status: "active",
      limit: 100,
      expand: ["data.items.data.price"],
    });
    for (const sub of subscriptions.data) {
      for (const item of sub.items.data) {
        const price = item.price;
        const amount = price.unit_amount ?? 0;
        const interval = price.recurring?.interval;
        const intervalCount = price.recurring?.interval_count ?? 1;
        if (interval === "month") {
          mrr += (amount / 100) / intervalCount;
        } else if (interval === "year") {
          mrr += (amount / 100) / (12 * intervalCount);
        }
      }
    }
    mrr = Math.round(mrr * 100) / 100;
  } catch (_err) {
    // Stripe unavailable — leave mrr as 0
  }

  // Trial → paid conversion rate (30d)
  const trialsStarted30d = Number(trialsStartedRows[0]?.value ?? 0);
  const converted30d = Number(proConvertedRows[0]?.value ?? 0);
  const conversionRate30d =
    trialsStarted30d > 0 ? Math.round((converted30d / trialsStarted30d) * 1000) / 10 : 0;

  // User table enriched with lane counts
  const userRows = allUsers.map((u) => ({
    id: u.id,
    email: u.email,
    plan: u.planTier,
    subscriptionStatus: u.subscriptionStatus,
    lanesCount: lanesMap.get(u.id) ?? 0,
    trialEndsAt: u.trialEndsAt,
    createdAt: u.createdAt,
  }));

  // Signups by day — normalize rows from neon execute (result has a .rows property)
  const rawRows = (signupsByDayRows as unknown as { rows: Record<string, unknown>[] }).rows
    ?? (signupsByDayRows as unknown as Record<string, unknown>[]);
  const signupsByDay = rawRows.map((r) => ({
    date: String(r.date ?? "").split("T")[0],
    count: Number(r.count ?? 0),
  }));

  return Response.json({
    metrics: {
      mrr,
      activePro,
      activeFree,
      activeTrials,
      conversionRate30d,
      signupsToday: Number(signupsTodayRows[0]?.value ?? 0),
      signupsThisWeek: Number(signupsWeekRows[0]?.value ?? 0),
      signupsThisMonth: Number(signupsMonthRows[0]?.value ?? 0),
      demoBookings: Number(demoLeadsRows[0]?.value ?? 0),
      reportSharesTotal: Number(reportSharesRows[0]?.total ?? 0),
      reportSharesConverted: Number(reportSharesRows[0]?.converted ?? 0),
    },
    featureUsage: [
      { feature: "Lanes Created", count: lanesRows.reduce((s, r) => s + Number(r.laneCount), 0) },
      { feature: "Briefs Generated", count: Number(briefsRows[0]?.value ?? 0) },
      { feature: "Rate Lookups", count: Number(snapshotsRows[0]?.value ?? 0) },
      { feature: "Report Shares", count: Number(reportSharesRows[0]?.total ?? 0) },
    ],
    signupsByDay,
    users: userRows,
  });
}
