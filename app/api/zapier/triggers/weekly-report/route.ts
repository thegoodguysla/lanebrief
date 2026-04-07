import { validateApiKey, isValidatedKey } from "@/lib/api-key";
import { getDb } from "@/lib/db";
import { zapierAlertEvents } from "@/lib/db/schema";
import { and, eq, desc, gte } from "drizzle-orm";

// GET /api/zapier/triggers/weekly-report
// Zapier polls this for new weekly report events.
export async function GET(request: Request) {
  const validated = await validateApiKey(request);
  if (!isValidatedKey(validated)) {
    return Response.json({ error: validated.error }, { status: validated.status });
  }

  const db = getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const events = await db
    .select()
    .from(zapierAlertEvents)
    .where(
      and(
        eq(zapierAlertEvents.userId, validated.userId),
        eq(zapierAlertEvents.eventType, "weekly_report"),
        gte(zapierAlertEvents.firedAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(zapierAlertEvents.firedAt))
    .limit(10);

  return Response.json(
    events.map((e) => ({
      id: e.id,
      ...JSON.parse(e.payload),
      fired_at: e.firedAt,
    }))
  );
}
