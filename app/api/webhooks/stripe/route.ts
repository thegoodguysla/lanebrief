import Stripe from "stripe";
import { getDb } from "@/lib/db";
import { users, affiliates, affiliateEarnings } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  notifyNewPaidSubscriber,
  notifyTrialStarted,
  notifyPaymentFailed,
  notifySubscriptionCancelled,
} from "@/lib/notify";

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

      const updateFields: Record<string, unknown> = {
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        planTier: isActive ? "pro" : "free",
        updatedAt: new Date(),
      };
      // Track when subscription first became active (for Day-7 testimonial cron)
      if (event.type === "customer.subscription.created" && isActive) {
        updateFields.subscriptionCreatedAt = new Date(subscription.created * 1000);
      }

      await db
        .update(users)
        .set(updateFields)
        .where(eq(users.stripeCustomerId, customerId));
      console.log(`Subscription ${event.type}: ${subscription.id}, status: ${subscription.status}`);

      // Owner notifications — only on new subscription creation
      if (event.type === "customer.subscription.created") {
        const [user] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.stripeCustomerId, customerId))
          .limit(1);

        if (user) {
          if (subscription.status === "trialing") {
            const trialEnd = subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : new Date(Date.now() + 7 * 86400_000);
            notifyTrialStarted({ email: user.email, trialEndsAt: trialEnd });
          } else if (subscription.status === "active") {
            const item = subscription.items.data[0];
            const amountCents = item?.price?.unit_amount ?? 0;
            const interval = item?.price?.recurring?.interval ?? "month";
            const plan = interval === "year" ? "Pro Annual" : "Pro Monthly";
            notifyNewPaidSubscriber({
              email: user.email,
              plan,
              amountCents,
              stripeCustomerId: customerId,
            });
          }
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const [user] = await db
        .select({ email: users.email, subscriptionCreatedAt: users.subscriptionCreatedAt })
        .from(users)
        .where(eq(users.stripeCustomerId, customerId))
        .limit(1);

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

      if (user) {
        const daysAsCustomer = user.subscriptionCreatedAt
          ? Math.floor((Date.now() - user.subscriptionCreatedAt.getTime()) / 86400_000)
          : 0;
        notifySubscriptionCancelled({
          email: user.email,
          subscriptionId: subscription.id,
          daysAsCustomer,
          stripeCustomerId: customerId,
        });
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const amountPaidCents = invoice.amount_paid ?? 0;

      // Credit 20% affiliate commission if this user was referred
      if (customerId && amountPaidCents > 0) {
        const [user] = await db
          .select({ id: users.id, affiliateCode: users.affiliateCode })
          .from(users)
          .where(eq(users.stripeCustomerId, customerId))
          .limit(1);

        if (user?.affiliateCode) {
          const [affiliate] = await db
            .select({ id: affiliates.id })
            .from(affiliates)
            .where(eq(affiliates.code, user.affiliateCode))
            .limit(1);

          if (affiliate) {
            const commissionUsd = Math.round(amountPaidCents * 0.20) / 100;

            // Idempotent: unique constraint on invoice_id prevents double-crediting
            await db
              .insert(affiliateEarnings)
              .values({
                id: randomUUID(),
                affiliateId: affiliate.id,
                userId: user.id,
                invoiceId: invoice.id,
                amountUsd: commissionUsd,
              })
              .onConflictDoNothing();

            await db
              .update(affiliates)
              .set({
                pendingEarnings: sql`${affiliates.pendingEarnings} + ${commissionUsd}`,
                updatedAt: new Date(),
              })
              .where(eq(affiliates.id, affiliate.id));

            console.log(`Affiliate commission: ${commissionUsd} USD → affiliate ${affiliate.id} for invoice ${invoice.id}`);
          }
        }
      }

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

        const [user] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.stripeCustomerId, customerId))
          .limit(1);

        if (user) {
          const lastAttempt = invoice.last_finalization_error?.message ?? null;
          notifyPaymentFailed({
            email: user.email,
            invoiceId: invoice.id,
            amountCents: invoice.amount_due ?? 0,
            declineReason: lastAttempt,
            stripeCustomerId: customerId,
          });
        }
      }
      console.error(`Payment failed: ${invoice.id}, customer: ${invoice.customer_email}`);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return Response.json({ received: true });
}
