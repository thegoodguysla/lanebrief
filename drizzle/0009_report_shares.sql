CREATE TABLE "report_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_user_id" text NOT NULL,
	"referred_email" text NOT NULL,
	"share_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"converted" boolean DEFAULT false NOT NULL,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_shares_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX "report_shares_referrer_idx" ON "report_shares" USING btree ("referrer_user_id");
--> statement-breakpoint
CREATE INDEX "report_shares_token_idx" ON "report_shares" USING btree ("share_token");
