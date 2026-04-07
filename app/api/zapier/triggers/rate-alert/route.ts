import { validateApiKey, isValidatedKey } from "@/lib/api-key";
import { getDb } from "@/lib/db";
import { zapierAlertEvents } from "@/lib/db/schema";
import { and, eq, desc, gte } from "drizzle-orm";

// GET /api/zapier/triggers/rate-alert
// Zapier polls this endpoint every ~15 minutes to pick up new rate alert events.
// Returns the 25 most recent rate_alert events for this user from the last 7 days.
export async function GET(request: Request) {
  const validated = await validateApiKey(request);
  if (!isValidatedKey(validated)) {
    return Response.json({ error: validated.error }, { status: validated.status });
  }

  const db = getDb();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const events = await db
    .select()
    .from(zapierAlertEvents)
    .where(
      and(
        eq(zapierAlertEvents.userId, validated.userId),
        eq(zapierAlertEvents.eventType, "rate_alert"),
        gte(zapierAlertEvents.firedAt, sevenDaysAgo)
      )
    )
    .orderBy(desc(zapierAlertEvents.firedAt))
    .limit(25);

  // Zapier expects an array of objects with a stable unique `id` field
  return Response.json(
    events.map((e) => ({
      id: e.id,
      ...JSON.parse(e.payload),
      fired_at: e.firedAt,
    }))
  );
}
