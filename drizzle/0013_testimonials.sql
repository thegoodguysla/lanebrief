-- Migration: Testimonial collection system
-- Adds subscriptionCreatedAt to users, testimonial_tokens, and testimonials tables.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_created_at" timestamp;

CREATE TABLE IF NOT EXISTS "testimonial_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "testimonial_tokens_user_idx" ON "testimonial_tokens" ("user_id");
CREATE INDEX IF NOT EXISTS "testimonial_tokens_hash_idx" ON "testimonial_tokens" ("token_hash");

CREATE TABLE IF NOT EXISTS "testimonials" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "rating" integer NOT NULL,
  "text" text,
  "name" text NOT NULL,
  "title" text,
  "approved" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "testimonials_approved_idx" ON "testimonials" ("approved");
