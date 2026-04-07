import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { affiliates, affiliateEarnings, affiliatePayouts, users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const ADMIN_EMAILS = ["nick@lanebrief.com", "nick@thegoodguys.la"];

// POST /api/admin/affiliates/payout
// Body: { affiliateId, method?: 'stripe' | 'paypal', notes?: string }
// Marks all pending earnings as paid, creates payout record, zeroes pending balance.
export async function POST(req: Request) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [caller] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (!caller || !ADMIN_EMAILS.includes(caller.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { affiliateId, method = "stripe", notes } = await req.json() as {
    affiliateId: string;
    method?: string;
    notes?: string;
  };

  if (!affiliateId) return Response.json({ error: "affiliateId required" }, { status: 400 });

  const [affiliate] = await db
    .select()
    .from(affiliates)
    .where(eq(affiliates.id, affiliateId))
    .limit(1);

  if (!affiliate) return Response.json({ error: "Affiliate not found" }, { status: 404 });

  const amount = affiliate.pendingEarnings;
  if (amount <= 0) {
    return Response.json({ error: "No pending earnings to pay out" }, { status: 400 });
  }

  // Mark all unpaid earnings as paid
  await db
    .update(affiliateEarnings)
    .set({ paidOut: true })
    .where(eq(affiliateEarnings.affiliateId, affiliateId));

  // Create payout record
  const [payout] = await db
    .insert(affiliatePayouts)
    .values({
      id: randomUUID(),
      affiliateId,
      amountUsd: amount,
      method,
      notes: notes ?? null,
    })
    .returning();

  // Move pending → paid on affiliate record
  await db
    .update(affiliates)
    .set({
      pendingEarnings: 0,
      paidEarnings: sql`${affiliates.paidEarnings} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(affiliates.id, affiliateId));

  console.log(`Payout: $${amount} to affiliate ${affiliateId} via ${method} by ${caller.email}`);
  return Response.json({ payout });
}
