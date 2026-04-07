-- Lane Chat: log all chat messages for quality review and fine-tuning
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" text PRIMARY KEY,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "origin" text NOT NULL,
  "destination" text NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "chat_messages_user_idx" ON "chat_messages" ("user_id");
CREATE INDEX IF NOT EXISTS "chat_messages_lane_idx" ON "chat_messages" ("origin", "destination");
CREATE INDEX IF NOT EXISTS "chat_messages_created_idx" ON "chat_messages" ("created_at");
