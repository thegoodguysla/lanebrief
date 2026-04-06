import Stripe from "stripe";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = getDb();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await db
          .update(users)
          .set({
            stripeCustomerId: customerId,
            subscriptionId,
            subscriptionStatus: subscription.status,
            planTier: "pro",
            updatedAt: new Date(),
          })
          .where(eq(users.stripeCustomerId, customerId));
        console.log(`Checkout completed: ${session.id}, customer: ${customerId}, sub: ${subscriptionId}`);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const isActive = subscription.status === "active" || subscription.status === "trialing";

      await db
        .update(users)
        .set({
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          planTier: isActive ? "pro" : "free",
          updatedAt: new Date(),
        })
        .where(eq(users.stripeCustomerId, customerId));
      console.log(`Subscription ${event.type}: ${subscription.id}, status: ${subscription.status}`);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      await db
        .update(users)
        .set({
          subscriptionStatus: "canceled",
          planTier: "free",
          subscriptionId: null,
          updatedAt: new Date(),
        })
        .where(eq(users.stripeCustomerId, customerId));
      console.log(`Subscription cancelled: ${subscription.id}`);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`Invoice paid: ${invoice.id}, customer: ${invoice.customer_email}`);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      if (customerId) {
        await db
          .update(users)
          .set({ subscriptionStatus: "past_due", updatedAt: new Date() })
          .where(eq(users.stripeCustomerId, customerId));
      }
      console.error(`Payment failed: ${invoice.id}, customer: ${invoice.customer_email}`);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return Response.json({ received: true });
}
