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
ALTER TABLE "tender_acceptance_cache" ADD CONSTRAINT "tender_acceptance_cache_lane_id_lanes_id_fk" FOREIGN KEY ("lane_id") REFERENCES "public"."lanes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tender_acceptance_lane_idx" ON "tender_acceptance_cache" USING btree ("lane_id");
