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
DO $$ BEGIN
 ALTER TABLE "carrier_risk_cache" ADD CONSTRAINT "carrier_risk_cache_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "carrier_risk_carrier_idx" ON "carrier_risk_cache" USING btree ("carrier_id");
