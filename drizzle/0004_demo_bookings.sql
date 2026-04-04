-- Demo bookings table: captures name + email on /book-demo form submit
-- Used to trigger day-before reminder emails via cron
CREATE TABLE "demo_bookings" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "utm_source" text,
  "utm_campaign" text,
  "booked_at" timestamp DEFAULT now() NOT NULL,
  "reminder_sent_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "demo_bookings_email_idx" ON "demo_bookings" USING btree ("email");
--> statement-breakpoint
CREATE INDEX "demo_bookings_booked_at_idx" ON "demo_bookings" USING btree ("booked_at");
