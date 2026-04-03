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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "autonomous_fleet_profiles_carrier_id_unique" UNIQUE("carrier_id")
);
--> statement-breakpoint
CREATE TABLE "autonomous_corridor_coverage" (
	"id" text PRIMARY KEY NOT NULL,
	"carrier_id" text NOT NULL,
	"origin_region" text NOT NULL,
	"dest_region" text NOT NULL,
	"highway_id" text,
	"is_certified" boolean DEFAULT false NOT NULL,
	"max_daily_loads" integer,
	"coverage_started_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "autonomous_fleet_profiles" ADD CONSTRAINT "autonomous_fleet_profiles_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autonomous_corridor_coverage" ADD CONSTRAINT "autonomous_corridor_coverage_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "carriers_type_idx" ON "carriers" USING btree ("type");--> statement-breakpoint
CREATE INDEX "corridor_carrier_idx" ON "autonomous_corridor_coverage" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "corridor_origin_dest_idx" ON "autonomous_corridor_coverage" USING btree ("origin_region","dest_region");
