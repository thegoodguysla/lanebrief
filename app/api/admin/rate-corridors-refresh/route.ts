/**
 * Admin endpoint: batch-refresh Truckstop rate data for the top 50 US freight corridors.
 * Stores results in rate_corridor_cache table.
 * Called by cron or manually via admin UI.
 *
 * POST /api/admin/rate-corridors-refresh
 * Requires: CRON_SECRET in Authorization header
 */

import { getDb } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getBookedRateEstimate, isTruckstopConfigured } from "@/lib/truckstop";

export const maxDuration = 60;

const TOP_50_CORRIDORS = [
  { origin: "Los Angeles, CA", destination: "Phoenix, AZ" },
  { origin: "Los Angeles, CA", destination: "Dallas, TX" },
  { origin: "Los Angeles, CA", destination: "Chicago, IL" },
  { origin: "Los Angeles, CA", destination: "Atlanta, GA" },
  { origin: "Los Angeles, CA", destination: "Seattle, WA" },
  { origin: "Chicago, IL", destination: "Atlanta, GA" },
  { origin: "Chicago, IL", destination: "Dallas, TX" },
  { origin: "Chicago, IL", destination: "New York, NY" },
  { origin: "Chicago, IL", destination: "Los Angeles, CA" },
  { origin: "Chicago, IL", destination: "Detroit, MI" },
  { origin: "Atlanta, GA", destination: "Chicago, IL" },
  { origin: "Atlanta, GA", destination: "Dallas, TX" },
  { origin: "Atlanta, GA", destination: "New York, NY" },
  { origin: "Atlanta, GA", destination: "Miami, FL" },
  { origin: "Atlanta, GA", destination: "Charlotte, NC" },
  { origin: "Dallas, TX", destination: "Chicago, IL" },
  { origin: "Dallas, TX", destination: "Atlanta, GA" },
  { origin: "Dallas, TX", destination: "Houston, TX" },
  { origin: "Dallas, TX", destination: "Los Angeles, CA" },
  { origin: "Dallas, TX", destination: "Nashville, TN" },
  { origin: "New York, NY", destination: "Chicago, IL" },
  { origin: "New York, NY", destination: "Atlanta, GA" },
  { origin: "New York, NY", destination: "Dallas, TX" },
  { origin: "New York, NY", destination: "Miami, FL" },
  { origin: "New York, NY", destination: "Philadelphia, PA" },
  { origin: "Houston, TX", destination: "Dallas, TX" },
  { origin: "Houston, TX", destination: "Chicago, IL" },
  { origin: "Houston, TX", destination: "Atlanta, GA" },
  { origin: "Houston, TX", destination: "Los Angeles, CA" },
  { origin: "Phoenix, AZ", destination: "Los Angeles, CA" },
  { origin: "Phoenix, AZ", destination: "Dallas, TX" },
  { origin: "Phoenix, AZ", destination: "Chicago, IL" },
  { origin: "Seattle, WA", destination: "Los Angeles, CA" },
  { origin: "Seattle, WA", destination: "Chicago, IL" },
  { origin: "Seattle, WA", destination: "Portland, OR" },
  { origin: "Miami, FL", destination: "Atlanta, GA" },
  { origin: "Miami, FL", destination: "New York, NY" },
  { origin: "Miami, FL", destination: "Chicago, IL" },
  { origin: "Nashville, TN", destination: "Chicago, IL" },
  { origin: "Nashville, TN", destination: "Atlanta, GA" },
  { origin: "Nashville, TN", destination: "Dallas, TX" },
  { origin: "Charlotte, NC", destination: "Atlanta, GA" },
  { origin: "Charlotte, NC", destination: "Chicago, IL" },
  { origin: "Columbus, OH", destination: "Chicago, IL" },
  { origin: "Columbus, OH", destination: "Atlanta, GA" },
  { origin: "Memphis, TN", destination: "Chicago, IL" },
  { origin: "Memphis, TN", destination: "Atlanta, GA" },
  { origin: "Kansas City, MO", destination: "Chicago, IL" },
  { origin: "Kansas City, MO", destination: "Dallas, TX" },
  { origin: "Denver, CO", destination: "Chicago, IL" },
] as const;

const BATCH_SIZE = 10;

type CorridorResult =
  | { origin: string; destination: string; rate_per_mile: number }
  | { origin: string; destination: string; error: string };

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTruckstopConfigured()) {
    return Response.json({ error: "Truckstop credentials not configured" }, { status: 503 });
  }

  const db = getDb();

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS rate_corridor_cache (
      id TEXT PRIMARY KEY,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      equipment TEXT NOT NULL DEFAULT 'dry_van',
      rate_per_mile REAL NOT NULL,
      lower_bound REAL,
      upper_bound REAL,
      data_source TEXT NOT NULL DEFAULT 'truckstop_booked',
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const results: CorridorResult[] = [];

  // Process in batches of BATCH_SIZE to parallelize without overwhelming the API
  for (let i = 0; i < TOP_50_CORRIDORS.length; i += BATCH_SIZE) {
    const batch = TOP_50_CORRIDORS.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (corridor) => {
        const estimate = await getBookedRateEstimate(corridor.origin, corridor.destination, "dry_van");
        const id = `${corridor.origin}|${corridor.destination}|dry_van`
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9|_]/g, "");

        await db.execute(sql`
          INSERT INTO rate_corridor_cache (id, origin, destination, equipment, rate_per_mile, lower_bound, upper_bound, data_source, fetched_at)
          VALUES (${id}, ${corridor.origin}, ${corridor.destination}, 'dry_van', ${estimate.ratePerMile}, ${estimate.lowerBound ?? null}, ${estimate.upperBound ?? null}, ${estimate.source}, NOW())
          ON CONFLICT (id) DO UPDATE SET
            rate_per_mile = EXCLUDED.rate_per_mile,
            lower_bound = EXCLUDED.lower_bound,
            upper_bound = EXCLUDED.upper_bound,
            data_source = EXCLUDED.data_source,
            fetched_at = NOW()
        `);

        return { origin: corridor.origin, destination: corridor.destination, rate_per_mile: estimate.ratePerMile };
      })
    );

    settled.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error(`[rate-corridors-refresh] Failed ${batch[idx].origin} → ${batch[idx].destination}:`, msg);
        results.push({ origin: batch[idx].origin, destination: batch[idx].destination, error: msg });
      }
    });
  }

  const successCount = results.filter((r) => !("error" in r)).length;
  const errorCount = results.length - successCount;

  return Response.json({ success: successCount, errors: errorCount, results });
}
