-- SMS Rate Alerts: phone number, verification, and opt-in flags on users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "phone" text,
  ADD COLUMN IF NOT EXISTS "phone_verified" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sms_alert_opt_in" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sms_weekly_opt_in" boolean NOT NULL DEFAULT false;

-- SMS phone verification codes (6-digit, short-lived)
CREATE TABLE IF NOT EXISTS "sms_verification_codes" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "phone" text NOT NULL,
  "code" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sms_codes_user_idx" ON "sms_verification_codes" ("user_id");
