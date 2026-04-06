import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const STRIPE_PRICES = {
  proMonthly: "price_1TJMbh6gqSUZxQFlRfB4LVco",
  proAnnual: "price_1TJMbi6gqSUZxQFlObgyPNOS",
} as const;

export const FREE_LANE_LIMIT = 3;

/** Returns true if the user has an active Pro subscription or active trial */
export function isPro(user: {
  planTier: string;
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
}): boolean {
  if (user.planTier === "pro" && (user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing")) {
    return true;
  }
  // Active trial
  if (user.trialEndsAt && new Date(user.trialEndsAt) > new Date()) {
    return true;
  }
  return false;
}
