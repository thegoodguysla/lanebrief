CREATE TABLE "onboarding_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email_number" integer NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_emails_user_number" UNIQUE("user_id","email_number")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "onboarding_emails" ADD CONSTRAINT "onboarding_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX "onboarding_emails_user_idx" ON "onboarding_emails" USING btree ("user_id");
