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
ALTER TABLE "lane_rate_forecasts" ADD CONSTRAINT "lane_rate_forecasts_lane_id_lanes_id_fk" FOREIGN KEY ("lane_id") REFERENCES "public"."lanes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "lane_rate_forecasts_lane_idx" ON "lane_rate_forecasts" USING btree ("lane_id");
--> statement-breakpoint
CREATE INDEX "lane_rate_forecasts_expires_idx" ON "lane_rate_forecasts" USING btree ("expires_at");
