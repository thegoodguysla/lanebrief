// lib/notify.ts — owner notification emails to nick@lanebrief.com
// Feature flag: set NOTIFY_NICK=true in Vercel env vars to enable.
// All emails are plain-text, CC'd to nick@thegoodguys.la.

import { Resend } from "resend";

const TO = "nick@lanebrief.com";
const CC = "nick@thegoodguys.la";
const FROM = "LaneBrief Alerts <nick@email.lanebrief.com>";

function enabled(): boolean {
  return process.env.NOTIFY_NICK === "true";
}

async function send(subject: string, text: string): Promise<void> {
  if (!enabled() || !process.env.RESEND_API_KEY) return;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: FROM, to: TO, cc: CC, subject, text });
  } catch (err) {
    console.error("[notify] Failed to send owner notification:", err);
  }
}

export async function notifyNewSignup(params: {
  email: string;
  source?: string | null;
}): Promise<void> {
  await send(
    `🆕 New signup: ${params.email}`,
    `New free account created.

Email: ${params.email}
Source: ${params.source ?? "direct"}

Reach out within the first hour — conversion rate is highest in this window.
https://lanebrief.com/admin`
  );
}

export async function notifyNewPaidSubscriber(params: {
  email: string;
  name?: string | null;
  plan: string;
  amountCents: number;
  stripeCustomerId: string;
}): Promise<void> {
  const dollars = (params.amountCents / 100).toFixed(2);
  const stripeUrl = `https://dashboard.stripe.com/customers/${params.stripeCustomerId}`;
  await send(
    `💰 New paid subscriber: ${params.email}`,
    `New paying customer!

Name: ${params.name ?? "Unknown"}
Email: ${params.email}
Plan: ${params.plan}
Amount: $${dollars}
Stripe: ${stripeUrl}

Send a personal thank-you email — makes a strong first impression.`
  );
}

export async function notifyTrialStarted(params: {
  email: string;
  trialEndsAt: Date;
}): Promise<void> {
  const ends = params.trialEndsAt.toDateString();
  await send(
    `🎯 Trial started: ${params.email}`,
    `A user just started a Pro trial.

Email: ${params.email}
Trial ends: ${ends}

Send a personal welcome to increase trial-to-paid conversion.
https://lanebrief.com/admin`
  );
}

export async function notifyPaymentFailed(params: {
  email: string;
  invoiceId: string;
  amountCents: number;
  declineReason?: string | null;
  stripeCustomerId: string;
}): Promise<void> {
  const dollars = (params.amountCents / 100).toFixed(2);
  const stripeUrl = `https://dashboard.stripe.com/customers/${params.stripeCustomerId}`;
  await send(
    `⚠️ Payment failed: ${params.email}`,
    `A payment failed — Stripe will retry automatically.

Email: ${params.email}
Amount: $${dollars}
Reason: ${params.declineReason ?? "unknown"}
Invoice: ${params.invoiceId}
Stripe: ${stripeUrl}

Stripe retries automatically. If it fails 3x, reach out personally.`
  );
}

export async function notifySubscriptionCancelled(params: {
  email: string;
  subscriptionId: string;
  daysAsCustomer: number;
  stripeCustomerId: string;
}): Promise<void> {
  const stripeUrl = `https://dashboard.stripe.com/customers/${params.stripeCustomerId}`;
  const mrr = "$79/mo";
  await send(
    `🚨 Churn: ${params.email}`,
    `A customer cancelled their subscription.

Email: ${params.email}
Days as customer: ${params.daysAsCustomer}
MRR impact: -${mrr}
Stripe: ${stripeUrl}

Win-back email within 48 hours has the highest success rate. Ask why they left.`
  );
}

export async function notifyTrialExpiringSoon(params: {
  email: string;
  trialEndsAt: Date;
  laneCount: number;
}): Promise<void> {
  const ends = params.trialEndsAt.toDateString();
  await send(
    `⏰ Trial expiring tomorrow: ${params.email}`,
    `A trial expires tomorrow — they haven't upgraded yet.

Email: ${params.email}
Trial ends: ${ends}
Lanes tracked: ${params.laneCount}

Personal outreach now has a high conversion rate. Offer to answer questions.
https://lanebrief.com/admin`
  );
}
