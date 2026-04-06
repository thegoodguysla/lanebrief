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
DO $$ BEGIN
 ALTER TABLE "capacity_heatmap_cache" ADD CONSTRAINT "capacity_heatmap_cache_lane_id_lanes_id_fk" FOREIGN KEY ("lane_id") REFERENCES "public"."lanes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_heatmap_lane_idx" ON "capacity_heatmap_cache" USING btree ("lane_id");
