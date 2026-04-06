import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });
  if (!user.stripeCustomerId) return Response.json({ error: "No billing account" }, { status: 400 });

  const origin = req.headers.get("origin") ?? "https://lanebrief.com";

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${origin}/dashboard`,
  });

  return Response.json({ url: session.url });
}
