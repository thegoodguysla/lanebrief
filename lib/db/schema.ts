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
  autonomousBeta: boolean("autonomous_beta").notNull().default(false),
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
export type DemoBooking = typeof demoBookings.$inferSelect;
export type NewDemoBooking = typeof demoBookings.$inferInsert;
