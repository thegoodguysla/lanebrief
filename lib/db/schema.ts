import { pgTable, text, integer, timestamp, real, unique } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Lane = typeof lanes.$inferSelect;
export type NewLane = typeof lanes.$inferInsert;
export type Brief = typeof briefs.$inferSelect;
export type NewBrief = typeof briefs.$inferInsert;
export type RateSnapshot = typeof rateSnapshots.$inferSelect;
export type NewRateSnapshot = typeof rateSnapshots.$inferInsert;
