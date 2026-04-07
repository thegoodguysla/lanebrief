import { validateApiKey, isValidatedKey } from "@/lib/api-key";
import { getDb } from "@/lib/db";
import { laneRateForecasts, lanes } from "@/lib/db/schema";
import { eq, and, desc, gt } from "drizzle-orm";

export async function GET(request: Request) {
  const validated = await validateApiKey(request);
  if (!isValidatedKey(validated)) {
    return Response.json({ error: validated.error }, { status: validated.status });
  }

  const url = new URL(request.url);
  const origin = url.searchParams.get("origin");
  const destination = url.searchParams.get("destination");
  const equipment = url.searchParams.get("equipment") ?? "dry_van";

  if (!origin || !destination) {
    return Response.json({ error: "origin and destination are required" }, { status: 400 });
  }

  const db = getDb();
  const now = new Date();
  const forecast = await db
    .select()
    .from(laneRateForecasts)
    .innerJoin(lanes, eq(laneRateForecasts.laneId, lanes.id))
    .where(
      and(
        eq(lanes.userId, validated.userId),
        eq(laneRateForecasts.origin, origin),
        eq(laneRateForecasts.destination, destination),
        eq(laneRateForecasts.equipment, equipment),
        gt(laneRateForecasts.expiresAt, now)
      )
    )
    .orderBy(desc(laneRateForecasts.generatedAt))
    .limit(1);

  if (forecast.length === 0) {
    return Response.json({ error: "No forecast data available for this lane." }, { status: 404 });
  }

  const f = forecast[0].lane_rate_forecasts;
  return Response.json({
    direction: f.direction,
    pct_change: f.pctChange,
    confidence: f.confidence,
    horizon_days: 7,
    generated_at: f.generatedAt,
  });
}
