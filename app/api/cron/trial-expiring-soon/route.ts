import { getDb } from "@/lib/db";
import { users, lanes } from "@/lib/db/schema";
import { and, gte, lte, eq, count } from "drizzle-orm";
import { notifyTrialExpiringSoon } from "@/lib/notify";

// Vercel Cron: daily at 9am ET (14:00 UTC)
// Notifies Nick about trials that expire tomorrow (no upgrade yet).

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  // Find trialing users whose trial ends tomorrow and haven't upgraded
  const expiringUsers = await db
    .select({ id: users.id, email: users.email, trialEndsAt: users.trialEndsAt })
    .from(users)
    .where(
      and(
        eq(users.subscriptionStatus, "trialing"),
        gte(users.trialEndsAt, tomorrowStart),
        lte(users.trialEndsAt, tomorrowEnd)
      )
    );

  let notified = 0;
  for (const user of expiringUsers) {
    if (!user.trialEndsAt) continue;

    const [laneCountRow] = await db
      .select({ count: count() })
      .from(lanes)
      .where(eq(lanes.userId, user.id));

    await notifyTrialExpiringSoon({
      email: user.email,
      trialEndsAt: user.trialEndsAt,
      laneCount: laneCountRow?.count ?? 0,
    });
    notified++;
  }

  console.log(`[trial-expiring-soon] Notified Nick about ${notified} expiring trials`);
  return Response.json({ notified });
}
