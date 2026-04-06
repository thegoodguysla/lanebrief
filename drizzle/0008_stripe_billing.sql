CREATE TABLE "autonomous_corridor_coverage" (
	"id" text PRIMARY KEY NOT NULL,
	"carrier_id" text NOT NULL,
	"origin_region" text NOT NULL,
	"dest_region" text NOT NULL,
	"highway_id" text,
	"is_certified" boolean DEFAULT false NOT NULL,
	"max_daily_loads" integer,
	"coverage_started_at" timestamp,
	"sae_level" integer,
	"weather_conditions" text DEFAULT 'clear_only',
	"operating_hours" text DEFAULT 'daytime_only',
	"min_speed_mph" integer,
	"max_speed_mph" integer,
	"road_types" text DEFAULT 'interstate_only',
	"odd_validated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autonomous_fleet_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"carrier_id" text NOT NULL,
	"fmcsa_cert_status" text DEFAULT 'none' NOT NULL,
	"cert_number" text,
	"cert_expiry" timestamp,
	"uptime_sla_percent" real,
	"driverless_miles_per_incident" real,
	"active_truck_count" integer,
	"last_synced_at" timestamp,
	"ads_provider" text,
	"ads_system_version" text,
	"sae_max_level" integer,
	"has_human_fallback" boolean DEFAULT true,
	"telemetry_api_provider" text,
	"telemetry_api_endpoint" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "autonomous_fleet_profiles_carrier_id_unique" UNIQUE("carrier_id")
);
--> statement-breakpoint
CREATE TABLE "capacity_heatmap_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"lane_id" text NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"equipment" text NOT NULL,
	"capacity_level" text NOT NULL,
	"estimated_carrier_count" integer NOT NULL,
	"reasoning" text NOT NULL,
	"alternatives" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carrier_risk_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"carrier_id" text NOT NULL,
	"score" integer NOT NULL,
	"tier" text NOT NULL,
	"signals" text NOT NULL,
	"reasoning" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carriers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'traditional' NOT NULL,
	"dot_number" text,
	"website" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"utm_source" text,
	"utm_campaign" text,
	"booked_at" timestamp DEFAULT now() NOT NULL,
	"reminder_sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "lane_rate_forecasts" (
	"id" text PRIMARY KEY NOT NULL,
	"lane_id" text NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"equipment" text NOT NULL,
	"direction" text NOT NULL,
	"pct_change" real NOT NULL,
	"confidence" text NOT NULL,
	"reasoning" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tender_acceptance_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"lane_id" text NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"equipment" text NOT NULL,
	"risk_level" text NOT NULL,
	"estimated_acceptance_pct" integer NOT NULL,
	"reasoning" text NOT NULL,
	"factors" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "alert_mode" text DEFAULT 'digest' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "autonomous_beta" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_tier" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "autonomous_corridor_coverage" ADD CONSTRAINT "autonomous_corridor_coverage_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autonomous_fleet_profiles" ADD CONSTRAINT "autonomous_fleet_profiles_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_heatmap_cache" ADD CONSTRAINT "capacity_heatmap_cache_lane_id_lanes_id_fk" FOREIGN KEY ("lane_id") REFERENCES "public"."lanes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_risk_cache" ADD CONSTRAINT "carrier_risk_cache_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lane_rate_forecasts" ADD CONSTRAINT "lane_rate_forecasts_lane_id_lanes_id_fk" FOREIGN KEY ("lane_id") REFERENCES "public"."lanes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_acceptance_cache" ADD CONSTRAINT "tender_acceptance_cache_lane_id_lanes_id_fk" FOREIGN KEY ("lane_id") REFERENCES "public"."lanes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "corridor_carrier_idx" ON "autonomous_corridor_coverage" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "corridor_origin_dest_idx" ON "autonomous_corridor_coverage" USING btree ("origin_region","dest_region");--> statement-breakpoint
CREATE INDEX "corridor_sae_level_idx" ON "autonomous_corridor_coverage" USING btree ("sae_level");--> statement-breakpoint
CREATE INDEX "capacity_heatmap_lane_idx" ON "capacity_heatmap_cache" USING btree ("lane_id");--> statement-breakpoint
CREATE INDEX "carrier_risk_carrier_idx" ON "carrier_risk_cache" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "carriers_type_idx" ON "carriers" USING btree ("type");--> statement-breakpoint
CREATE INDEX "demo_bookings_email_idx" ON "demo_bookings" USING btree ("email");--> statement-breakpoint
CREATE INDEX "demo_bookings_booked_at_idx" ON "demo_bookings" USING btree ("booked_at");--> statement-breakpoint
CREATE INDEX "lane_rate_forecasts_lane_idx" ON "lane_rate_forecasts" USING btree ("lane_id");--> statement-breakpoint
CREATE INDEX "lane_rate_forecasts_expires_idx" ON "lane_rate_forecasts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "tender_acceptance_lane_idx" ON "tender_acceptance_cache" USING btree ("lane_id");