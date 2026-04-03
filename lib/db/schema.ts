import { pgTable, text, integer, timestamp, real, unique, boolean, index } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("corridor_carrier_idx").on(t.carrierId),
  index("corridor_origin_dest_idx").on(t.originRegion, t.destRegion),
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
