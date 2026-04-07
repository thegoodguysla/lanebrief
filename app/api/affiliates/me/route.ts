import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { affiliates, affiliateEarnings, affiliatePayouts, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/affiliates/me
// Returns the affiliate account linked to the current user's email.
export async function GET() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const [affiliate] = await db
    .select()
    .from(affiliates)
    .where(eq(affiliates.email, user.email))
    .limit(1);

  if (!affiliate) return Response.json({ affiliate: null });

  const earnings = await db
    .select()
    .from(affiliateEarnings)
    .where(eq(affiliateEarnings.affiliateId, affiliate.id))
    .orderBy(desc(affiliateEarnings.createdAt));

  const payouts = await db
    .select()
    .from(affiliatePayouts)
    .where(eq(affiliatePayouts.affiliateId, affiliate.id))
    .orderBy(desc(affiliatePayouts.paidAt));

  // Count referred signups
  const referredUsers = await db
    .select({ id: users.id, createdAt: users.createdAt, planTier: users.planTier })
    .from(users)
    .where(eq(users.affiliateCode, affiliate.code));

  const conversions = referredUsers.filter((u) => u.planTier === "pro").length;

  return Response.json({
    affiliate,
    stats: {
      clicks: 0, // tracked client-side in future
      signups: referredUsers.length,
      conversions,
      pendingEarnings: affiliate.pendingEarnings,
      paidEarnings: affiliate.paidEarnings,
    },
    earnings,
    payouts,
  });
}
