import { pgTable, text, integer, timestamp, real, unique, boolean, index } from "drizzle-orm/pg-core";

export const demoBookings = pgTable("demo_bookings", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  utmSource: text("utm_source"),
  utmCampaign: text("utm_campaign"),
  bookedAt: timestamp("booked_at").notNull().defaultNow(),
  reminderSentAt: timestamp("reminder_sent_at"),
}, (t) => [
  index("demo_bookings_email_idx").on(t.email),
  index("demo_bookings_booked_at_idx").on(t.bookedAt),
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  alertOptIn: boolean("alert_opt_in").notNull().default(false),
  alertMode: text("alert_mode").notNull().default("digest"), // 'instant' | 'digest'
  autonomousBeta: boolean("autonomous_beta").notNull().default(false),
  // Billing / subscription
  stripeCustomerId: text("stripe_customer_id"),
  planTier: text("plan_tier").notNull().default("free"), // 'free' | 'pro'
  subscriptionStatus: text("subscription_status"), // 'active' | 'trialing' | 'past_due' | 'canceled' | null
  subscriptionId: text("subscription_id"),
  trialEndsAt: timestamp("trial_ends_at"),
  // Affiliate attribution (set on signup from ?ref= cookie)
  affiliateCode: text("affiliate_code"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const lanes = pgTable("lanes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  equipment: text("equipment").notNull().default("dry_van"),
  alertThresholdPct: integer("alert_threshold_pct").notNull().default(5),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("lanes_user_origin_dest").on(t.userId, t.origin, t.destination, t.equipment),
]);

export const briefs = pgTable("briefs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  laneId: text("lane_id").references(() => lanes.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  version: integer("version").notNull().default(1),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

export const rateSnapshots = pgTable("rate_snapshots", {
  id: text("id").primaryKey(),
  laneId: text("lane_id")
    .notNull()
    .references(() => lanes.id, { onDelete: "cascade" }),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  equipment: text("equipment").notNull(),
  ratePerMile: real("rate_per_mile").notNull(),
  marketAvgUsdPerMile: real("market_avg_usd_per_mile").notNull(),
  deltaPct: real("delta_pct").notNull(),
  verdict: text("verdict").notNull(),
  disclaimer: text("disclaimer"),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

// Autonomous Fleet Registry tables

export const carriers = pgTable("carriers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("traditional"), // 'traditional' | 'autonomous_fleet_operator'
  dotNumber: text("dot_number"),
  website: text("website"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("carriers_type_idx").on(t.type),
]);

export const autonomousFleetProfiles = pgTable("autonomous_fleet_profiles", {
  id: text("id").primaryKey(),
  carrierId: text("carrier_id").notNull().references(() => carriers.id, { onDelete: "cascade" }).unique(),
  fmcsaCertStatus: text("fmcsa_cert_status").notNull().default("none"), // 'certified' | 'provisional' | 'none'
  certNumber: text("cert_number"),
  certExpiry: timestamp("cert_expiry"),
  uptimeSlaPercent: real("uptime_sla_percent"),
  driverlessMilesPerIncident: real("driverless_miles_per_incident"),
  activeTruckCount: integer("active_truck_count"),
  lastSyncedAt: timestamp("last_synced_at"),
  // ADS qualification fields
  adsProvider: text("ads_provider"),            // e.g. 'Aurora', 'Waymo', 'Kodiak', 'Gatik'
  adsSystemVersion: text("ads_system_version"), // software/firmware version string
  saeMaxLevel: integer("sae_max_level"),        // highest SAE automation level certified (2-5)
  hasHumanFallback: boolean("has_human_fallback").default(true), // whether human operator fallback is available
  telemetryApiProvider: text("telemetry_api_provider"), // e.g. 'samsara', 'geotab', 'platform_science'
  telemetryApiEndpoint: text("telemetry_api_endpoint"), // direct ADS status feed URL if available
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const autonomousCorridorCoverage = pgTable("autonomous_corridor_coverage", {
  id: text("id").primaryKey(),
  carrierId: text("carrier_id").notNull().references(() => carriers.id, { onDelete: "cascade" }),
  originRegion: text("origin_region").notNull(),   // e.g. "Houston, TX"
  destRegion: text("dest_region").notNull(),         // e.g. "Dallas, TX"
  highwayId: text("highway_id"),                     // e.g. "I-45", "US-290"
  isCertified: boolean("is_certified").notNull().default(false),
  maxDailyLoads: integer("max_daily_loads"),
  coverageStartedAt: timestamp("coverage_started_at"),
  // ODD (Operational Design Domain) fields
  saeLevel: integer("sae_level"),                  // SAE automation level for this corridor (2-5)
  weatherConditions: text("weather_conditions").default("clear_only"), // 'clear_only' | 'rain_ok' | 'all_weather'
  operatingHours: text("operating_hours").default("daytime_only"),     // 'daytime_only' | 'extended' | '24_7'
  minSpeedMph: integer("min_speed_mph"),            // minimum speed for ADS engagement
  maxSpeedMph: integer("max_speed_mph"),            // maximum speed for ADS engagement (typically 65)
  roadTypes: text("road_types").default("interstate_only"), // 'interstate_only' | 'highway' | 'urban'
  oddValidatedAt: timestamp("odd_validated_at"),    // when ODD boundaries were last confirmed
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("corridor_carrier_idx").on(t.carrierId),
  index("corridor_origin_dest_idx").on(t.originRegion, t.destRegion),
  index("corridor_sae_level_idx").on(t.saeLevel),
]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Lane = typeof lanes.$inferSelect;
export type NewLane = typeof lanes.$inferInsert;
export type Brief = typeof briefs.$inferSelect;
export type NewBrief = typeof briefs.$inferInsert;
export type RateSnapshot = typeof rateSnapshots.$inferSelect;
export type NewRateSnapshot = typeof rateSnapshots.$inferInsert;
export type Carrier = typeof carriers.$inferSelect;
export type NewCarrier = typeof carriers.$inferInsert;
export type AutonomousFleetProfile = typeof autonomousFleetProfiles.$inferSelect;
export type NewAutonomousFleetProfile = typeof autonomousFleetProfiles.$inferInsert;
export type AutonomousCorridorCoverage = typeof autonomousCorridorCoverage.$inferSelect;
export type NewAutonomousCorridorCoverage = typeof autonomousCorridorCoverage.$inferInsert;
// Tender Acceptance Predictor cache
export const tenderAcceptanceCache = pgTable("tender_acceptance_cache", {
  id: text("id").primaryKey(),
  laneId: text("lane_id")
    .notNull()
    .references(() => lanes.id, { onDelete: "cascade" }),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  equipment: text("equipment").notNull(),
  riskLevel: text("risk_level").notNull(), // 'low' | 'medium' | 'high'
  estimatedAcceptancePct: integer("estimated_acceptance_pct").notNull(), // 0–100
  reasoning: text("reasoning").notNull(),
  factors: text("factors").notNull(), // JSON-serialized string[]
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
}, (t) => [
  index("tender_acceptance_lane_idx").on(t.laneId),
]);

export type DemoBooking = typeof demoBookings.$inferSelect;
export type NewDemoBooking = typeof demoBookings.$inferInsert;
export type TenderAcceptanceCache = typeof tenderAcceptanceCache.$inferSelect;
export type NewTenderAcceptanceCache = typeof tenderAcceptanceCache.$inferInsert;

// 7-Day Lane Rate Forecast cache
export const laneRateForecasts = pgTable("lane_rate_forecasts", {
  id: text("id").primaryKey(),
  laneId: text("lane_id")
    .notNull()
    .references(() => lanes.id, { onDelete: "cascade" }),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  equipment: text("equipment").notNull(),
  direction: text("direction").notNull(), // 'up' | 'down' | 'flat'
  pctChange: real("pct_change").notNull(), // estimated % rate change over 7 days
  confidence: text("confidence").notNull(), // 'high' | 'medium' | 'low'
  reasoning: text("reasoning").notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
}, (t) => [
  index("lane_rate_forecasts_lane_idx").on(t.laneId),
  index("lane_rate_forecasts_expires_idx").on(t.expiresAt),
]);

export type LaneRateForecast = typeof laneRateForecasts.$inferSelect;
export type NewLaneRateForecast = typeof laneRateForecasts.$inferInsert;

// Carrier Capacity Heatmap cache
export const capacityHeatmapCache = pgTable("capacity_heatmap_cache", {
  id: text("id").primaryKey(),
  laneId: text("lane_id")
    .notNull()
    .references(() => lanes.id, { onDelete: "cascade" }),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  equipment: text("equipment").notNull(),
  capacityLevel: text("capacity_level").notNull(), // 'tight' | 'moderate' | 'loose'
  estimatedCarrierCount: integer("estimated_carrier_count").notNull(),
  reasoning: text("reasoning").notNull(),
  alternatives: text("alternatives").notNull(), // JSON: [{origin, destination, reason}]
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
}, (t) => [
  index("capacity_heatmap_lane_idx").on(t.laneId),
]);

export type CapacityHeatmapCache = typeof capacityHeatmapCache.$inferSelect;
export type NewCapacityHeatmapCache = typeof capacityHeatmapCache.$inferInsert;

// Carrier Payment Risk Score cache
export const carrierRiskCache = pgTable("carrier_risk_cache", {
  id: text("id").primaryKey(),
  carrierId: text("carrier_id").notNull().references(() => carriers.id, { onDelete: "cascade" }),
  score: integer("score").notNull(), // 0–100 (lower = riskier)
  tier: text("tier").notNull(), // 'low' | 'medium' | 'high'
  signals: text("signals").notNull(), // JSON string[]
  reasoning: text("reasoning").notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
}, (t) => [
  index("carrier_risk_carrier_idx").on(t.carrierId),
]);

export type CarrierRiskCache = typeof carrierRiskCache.$inferSelect;
export type NewCarrierRiskCache = typeof carrierRiskCache.$inferInsert;

// Viral report sharing / referral tracking
export const reportShares = pgTable("report_shares", {
  id: text("id").primaryKey(),
  referrerUserId: text("referrer_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  referredEmail: text("referred_email").notNull(),
  shareToken: text("share_token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  converted: boolean("converted").notNull().default(false),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("report_shares_referrer_idx").on(t.referrerUserId),
  index("report_shares_token_idx").on(t.shareToken),
]);

export type ReportShare = typeof reportShares.$inferSelect;
export type NewReportShare = typeof reportShares.$inferInsert;

// Onboarding email drip sequence tracking
export const onboardingEmails = pgTable("onboarding_emails", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  emailNumber: integer("email_number").notNull(), // 1–5
  sentAt: timestamp("sent_at").notNull().defaultNow(),
}, (t) => [
  unique("onboarding_emails_user_number").on(t.userId, t.emailNumber),
  index("onboarding_emails_user_idx").on(t.userId),
]);

export type OnboardingEmail = typeof onboardingEmails.$inferSelect;
export type NewOnboardingEmail = typeof onboardingEmails.$inferInsert;

// Public API keys
export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Default"),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(), // first 16 chars for display (lb_live_xxxxxxxx)
  usageCount: integer("usage_count").notNull().default(0),
  usageResetAt: timestamp("usage_reset_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
}, (t) => [
  index("api_keys_user_idx").on(t.userId),
  index("api_keys_hash_idx").on(t.keyHash),
]);
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

// ─── Affiliate Program ───────────────────────────────────────────────────────

export const affiliates = pgTable("affiliates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  code: text("code").notNull().unique(),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  pendingEarnings: real("pending_earnings").notNull().default(0),
  paidEarnings: real("paid_earnings").notNull().default(0),
  notes: text("notes"),
  audience: text("audience"),
  howToPromote: text("how_to_promote"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("affiliates_code_idx").on(t.code),
  index("affiliates_email_idx").on(t.email),
]);

export const affiliateEarnings = pgTable("affiliate_earnings", {
  id: text("id").primaryKey(),
  affiliateId: text("affiliate_id").notNull().references(() => affiliates.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  invoiceId: text("invoice_id").notNull().unique(),
  amountUsd: real("amount_usd").notNull(),
  paidOut: boolean("paid_out").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("affiliate_earnings_affiliate_idx").on(t.affiliateId),
  index("affiliate_earnings_user_idx").on(t.userId),
]);

export const affiliatePayouts = pgTable("affiliate_payouts", {
  id: text("id").primaryKey(),
  affiliateId: text("affiliate_id").notNull().references(() => affiliates.id, { onDelete: "cascade" }),
  amountUsd: real("amount_usd").notNull(),
  method: text("method").notNull().default("stripe"), // 'stripe' | 'paypal'
  notes: text("notes"),
  paidAt: timestamp("paid_at").notNull().defaultNow(),
}, (t) => [
  index("affiliate_payouts_affiliate_idx").on(t.affiliateId),
]);

export type Affiliate = typeof affiliates.$inferSelect;
export type NewAffiliate = typeof affiliates.$inferInsert;
export type AffiliateEarning = typeof affiliateEarnings.$inferSelect;
export type NewAffiliateEarning = typeof affiliateEarnings.$inferInsert;
export type AffiliatePayout = typeof affiliatePayouts.$inferSelect;
export type NewAffiliatePayout = typeof affiliatePayouts.$inferInsert;
