import { validateApiKey, isValidatedKey } from "@/lib/api-key";
import { getDb } from "@/lib/db";
import { lanes, rateSnapshots } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  const validated = await validateApiKey(request);
  if (!isValidatedKey(validated)) {
    return Response.json({ error: validated.error }, { status: validated.status });
  }

  const db = getDb();
  const userLanes = await db
    .select()
    .from(lanes)
    .where(eq(lanes.userId, validated.userId));

  const lanesWithRates = await Promise.all(
    userLanes.map(async (lane) => {
      const snapshot = await db
        .select()
        .from(rateSnapshots)
        .where(eq(rateSnapshots.laneId, lane.id))
        .orderBy(desc(rateSnapshots.generatedAt))
        .limit(1);

      return {
        id: lane.id,
        origin: lane.origin,
        destination: lane.destination,
        equipment: lane.equipment,
        rate_per_mile: snapshot[0]?.ratePerMile ?? null,
        market_avg_usd_per_mile: snapshot[0]?.marketAvgUsdPerMile ?? null,
        rate_updated_at: snapshot[0]?.generatedAt ?? null,
      };
    })
  );

  return Response.json({ lanes: lanesWithRates });
}
