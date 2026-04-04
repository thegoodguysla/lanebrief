-- ODD (Operational Design Domain) fields on corridor coverage
-- Defines the specific conditions under which an ADS is certified to operate
ALTER TABLE "autonomous_corridor_coverage"
  ADD COLUMN "sae_level" integer,
  ADD COLUMN "weather_conditions" text DEFAULT 'clear_only',
  ADD COLUMN "operating_hours" text DEFAULT 'daytime_only',
  ADD COLUMN "min_speed_mph" integer,
  ADD COLUMN "max_speed_mph" integer,
  ADD COLUMN "road_types" text DEFAULT 'interstate_only',
  ADD COLUMN "odd_validated_at" timestamp;
--> statement-breakpoint

-- ADS (Automated Driving System) qualification fields on fleet profiles
-- Captures system-level ADS metadata for carrier scoring alongside FMCSA cert
ALTER TABLE "autonomous_fleet_profiles"
  ADD COLUMN "ads_provider" text,
  ADD COLUMN "ads_system_version" text,
  ADD COLUMN "sae_max_level" integer,
  ADD COLUMN "has_human_fallback" boolean DEFAULT true,
  ADD COLUMN "telemetry_api_provider" text,
  ADD COLUMN "telemetry_api_endpoint" text;
--> statement-breakpoint

CREATE INDEX "corridor_sae_level_idx" ON "autonomous_corridor_coverage" USING btree ("sae_level");
