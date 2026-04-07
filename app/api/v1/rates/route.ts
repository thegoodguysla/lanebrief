import { validateApiKey, isValidatedKey } from "@/lib/api-key";
import { getDb } from "@/lib/db";
import { rateSnapshots, lanes } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

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
  const snapshot = await db
    .select()
    .from(rateSnapshots)
    .innerJoin(lanes, eq(rateSnapshots.laneId, lanes.id))
    .where(
      and(
        eq(lanes.userId, validated.userId),
        eq(rateSnapshots.origin, origin),
        eq(rateSnapshots.destination, destination),
        eq(rateSnapshots.equipment, equipment)
      )
    )
    .orderBy(desc(rateSnapshots.generatedAt))
    .limit(1);

  if (snapshot.length === 0) {
    return Response.json({ error: "No rate data found for this lane. Add it to your portfolio first." }, { status: 404 });
  }

  const s = snapshot[0].rate_snapshots;
  return Response.json({
    rate_per_mile: s.ratePerMile,
    market_avg_usd_per_mile: s.marketAvgUsdPerMile,
    total_miles: null,
    confidence: "ai_estimated",
    updated_at: s.generatedAt,
  });
}
