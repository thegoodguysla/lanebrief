import { validateApiKey, isValidatedKey } from "@/lib/api-key";
import { getDb } from "@/lib/db";
import { zapierHooks } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const VALID_EVENT_TYPES = ["rate_alert", "weekly_report", "carrier_risk"] as const;

// POST /api/zapier/subscribe — Zapier calls this when a user enables a Zap
export async function POST(request: Request) {
  const validated = await validateApiKey(request);
  if (!isValidatedKey(validated)) {
    return Response.json({ error: validated.error }, { status: validated.status });
  }

  let body: { hookUrl?: string; eventType?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { hookUrl, eventType } = body;

  if (!hookUrl || typeof hookUrl !== "string" || !hookUrl.startsWith("https://")) {
    return Response.json({ error: "hookUrl must be a valid HTTPS URL" }, { status: 400 });
  }

  if (!eventType || !VALID_EVENT_TYPES.includes(eventType as typeof VALID_EVENT_TYPES[number])) {
    return Response.json(
      { error: `eventType must be one of: ${VALID_EVENT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const db = getDb();

  // Upsert: delete existing hook for this user+event, then insert new one
  await db
    .delete(zapierHooks)
    .where(and(eq(zapierHooks.userId, validated.userId), eq(zapierHooks.eventType, eventType)));

  const id = randomUUID();
  await db.insert(zapierHooks).values({
    id,
    userId: validated.userId,
    keyId: validated.keyId,
    eventType,
    hookUrl,
  });

  return Response.json({ id, subscribed: true, eventType });
}

// DELETE /api/zapier/subscribe — Zapier calls this when a user disables a Zap
export async function DELETE(request: Request) {
  const validated = await validateApiKey(request);
  if (!isValidatedKey(validated)) {
    return Response.json({ error: validated.error }, { status: validated.status });
  }

  const url = new URL(request.url);
  const eventType = url.searchParams.get("eventType");

  if (!eventType || !VALID_EVENT_TYPES.includes(eventType as typeof VALID_EVENT_TYPES[number])) {
    return Response.json(
      { error: `eventType must be one of: ${VALID_EVENT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const db = getDb();
  await db
    .delete(zapierHooks)
    .where(and(eq(zapierHooks.userId, validated.userId), eq(zapierHooks.eventType, eventType)));

  return Response.json({ unsubscribed: true, eventType });
}
