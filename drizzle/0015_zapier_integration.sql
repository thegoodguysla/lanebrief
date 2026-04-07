-- Zapier REST hooks subscriptions
CREATE TABLE IF NOT EXISTS "zapier_hooks" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "key_id" text NOT NULL REFERENCES "api_keys"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "hook_url" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "zapier_hooks_user_event_idx" ON "zapier_hooks" ("user_id", "event_type");

-- Recent events for Zapier polling (ring buffer, 7-day TTL via cron)
CREATE TABLE IF NOT EXISTS "zapier_alert_events" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "payload" text NOT NULL,
  "fired_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "zapier_alert_events_user_event_idx" ON "zapier_alert_events" ("user_id", "event_type");
CREATE INDEX IF NOT EXISTS "zapier_alert_events_fired_idx" ON "zapier_alert_events" ("fired_at");
