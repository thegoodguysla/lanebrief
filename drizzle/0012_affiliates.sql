-- Affiliates table: stores approved affiliate accounts
CREATE TABLE "affiliates" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "code" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  "pending_earnings" real NOT NULL DEFAULT 0,
  "paid_earnings" real NOT NULL DEFAULT 0,
  "notes" text,
  "audience" text,
  "how_to_promote" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Affiliate earnings log for auditability
CREATE TABLE "affiliate_earnings" (
  "id" text PRIMARY KEY NOT NULL,
  "affiliate_id" text NOT NULL REFERENCES "affiliates"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "invoice_id" text NOT NULL UNIQUE,
  "amount_usd" real NOT NULL,
  "paid_out" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Affiliate payout log
CREATE TABLE "affiliate_payouts" (
  "id" text PRIMARY KEY NOT NULL,
  "affiliate_id" text NOT NULL REFERENCES "affiliates"("id") ON DELETE cascade,
  "amount_usd" real NOT NULL,
  "method" text NOT NULL DEFAULT 'stripe', -- 'stripe' | 'paypal'
  "notes" text,
  "paid_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Track which affiliate code attributed a user (set on signup)
ALTER TABLE "users" ADD COLUMN "affiliate_code" text;
--> statement-breakpoint
CREATE INDEX "affiliates_code_idx" ON "affiliates" USING btree ("code");
CREATE INDEX "affiliates_email_idx" ON "affiliates" USING btree ("email");
CREATE INDEX "affiliate_earnings_affiliate_idx" ON "affiliate_earnings" USING btree ("affiliate_id");
CREATE INDEX "affiliate_earnings_user_idx" ON "affiliate_earnings" USING btree ("user_id");
CREATE INDEX "affiliate_payouts_affiliate_idx" ON "affiliate_payouts" USING btree ("affiliate_id");
CREATE INDEX "users_affiliate_code_idx" ON "users" USING btree ("affiliate_code");
