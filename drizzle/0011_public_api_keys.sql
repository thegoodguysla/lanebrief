CREATE TABLE "api_keys" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL DEFAULT 'Default',
  "key_hash" text NOT NULL UNIQUE,
  "key_prefix" text NOT NULL,
  "usage_count" integer NOT NULL DEFAULT 0,
  "usage_reset_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "revoked_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_tier_v2" text; -- placeholder if needed
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "api_keys_user_idx" ON "api_keys" USING btree ("user_id");
CREATE INDEX "api_keys_hash_idx" ON "api_keys" USING btree ("key_hash");
