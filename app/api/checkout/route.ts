import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stripe, STRIPE_PRICES } from "@/lib/stripe";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { priceId } = await req.json() as { priceId: string };
  const validPrices = Object.values(STRIPE_PRICES);
  if (!validPrices.includes(priceId as (typeof validPrices)[number])) {
    return Response.json({ error: "Invalid price" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? "https://lanebrief.com";

  // Reuse existing Stripe customer if available
  let customerId = user.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id, clerkId: userId },
    });
    customerId = customer.id;
    await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id));
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${origin}/dashboard?upgraded=1`,
    cancel_url: `${origin}/pricing`,
    metadata: { userId: user.id },
  });

  return Response.json({ url: session.url });
}
