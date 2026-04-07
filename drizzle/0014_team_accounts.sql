-- Migration: Team Accounts + Annual Upsell tracking
-- Adds annualUpsellSentAt + teamId to users, and creates teams/team_members tables.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "annual_upsell_sent_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "team_id" text;

CREATE TABLE IF NOT EXISTS "teams" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "stripe_subscription_id" text,
  "seat_count" integer NOT NULL DEFAULT 3,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "teams_owner_idx" ON "teams" ("owner_user_id");

CREATE TABLE IF NOT EXISTS "team_members" (
  "id" text PRIMARY KEY NOT NULL,
  "team_id" text NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "email" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "invite_token" text UNIQUE,
  "invite_expires_at" timestamp,
  "invited_at" timestamp NOT NULL DEFAULT now(),
  "joined_at" timestamp,
  UNIQUE ("team_id", "email")
);
CREATE INDEX IF NOT EXISTS "team_members_team_idx" ON "team_members" ("team_id");
CREATE INDEX IF NOT EXISTS "team_members_token_idx" ON "team_members" ("invite_token");
