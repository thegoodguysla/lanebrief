import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stripe, STRIPE_PRICES } from "@/lib/stripe";

// POST /api/billing/switch-annual
// Swaps the user's active monthly subscription to annual.
// Stripe handles proration: charges the annual balance upfront, credits unused monthly days.

export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      subscriptionId: users.subscriptionId,
      subscriptionStatus: users.subscriptionStatus,
      planTier: users.planTier,
    })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });
  if (!user.subscriptionId) return Response.json({ error: "No active subscription" }, { status: 400 });
  if (user.planTier !== "pro" || user.subscriptionStatus !== "active") {
    return Response.json({ error: "Not an active Pro subscriber" }, { status: 400 });
  }

  // Retrieve the subscription to check current price
  const subscription = await stripe.subscriptions.retrieve(user.subscriptionId);
  const currentPriceId = subscription.items.data[0]?.price?.id;

  if (currentPriceId === STRIPE_PRICES.proAnnual) {
    return Response.json({ error: "Already on annual plan" }, { status: 400 });
  }

  // Swap monthly → annual with proration
  const subscriptionItemId = subscription.items.data[0]?.id;
  if (!subscriptionItemId) {
    return Response.json({ error: "Subscription item not found" }, { status: 500 });
  }

  await stripe.subscriptions.update(user.subscriptionId, {
    items: [{ id: subscriptionItemId, price: STRIPE_PRICES.proAnnual }],
    proration_behavior: "always_invoice",
  });

  console.log(`[billing/switch-annual] User ${user.id} switched to annual`);
  return Response.json({ success: true });
}
