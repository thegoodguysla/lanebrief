import Stripe from "stripe";

let _stripe: Stripe | null = null;

// Lazy singleton — avoids "no apiKey" crash during Next.js build-time page collection
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    return (_stripe as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const STRIPE_PRICES = {
  proMonthly: "price_1TJMbh6gqSUZxQFlRfB4LVco",
  proAnnual: "price_1TJMbi6gqSUZxQFlObgyPNOS",
  // Team plans — create these in Stripe dashboard and set STRIPE_PRICE_TEAM_3 / STRIPE_PRICE_TEAM_10 env vars
  team3Monthly: process.env.STRIPE_PRICE_TEAM_3 ?? "",
  team10Monthly: process.env.STRIPE_PRICE_TEAM_10 ?? "",
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
