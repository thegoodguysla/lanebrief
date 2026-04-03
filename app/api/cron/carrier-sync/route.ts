import { getDb } from "@/lib/db";
import { carriers, autonomousFleetProfiles, autonomousCorridorCoverage } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { scrapeAurora, scrapeGatik, scrapeKodiak, validateCorridors } from "@/lib/autonomous/carrier-scrapers";
import { randomUUID } from "crypto";

// Vercel Cron: every Sunday 4am UTC (weekly carrier portal sync)
// vercel.json schedule: "0 4 * * 0"

const CARRIER_SCRAPERS: Record<string, () => Promise<Awaited<ReturnType<typeof scrapeAurora>>>> = {
  "Aurora Innovation": scrapeAurora,
  "Gatik AI": scrapeGatik,
  "Kodiak Robotics": scrapeKodiak,
};

// Freshness thresholds
const WARN_STALE_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days
const PAGE_STALE_MS = 14 * 24 * 60 * 60 * 1000;  // 14 days

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const results: Record<string, { corridors: number; quarantined: number; source: string; stale?: string }> = {};

  const allCarriers = await db
    .select()
    .from(carriers)
    .where(eq(carriers.type, "autonomous_fleet_operator"));

  for (const carrier of allCarriers) {
    const scraper = CARRIER_SCRAPERS[carrier.name];
    if (!scraper) {
      console.log(`[carrier-sync] No scraper for ${carrier.name}, skipping`);
      continue;
    }

    try {
      const data = await scraper();
      const { valid, quarantined } = validateCorridors(data.corridors);

      if (quarantined.length > 0) {
        console.warn(`[carrier-sync] ${carrier.name}: quarantined ${quarantined.length} records`, quarantined);
      }

      // Upsert corridors — only add new ones (don't delete manual overrides)
      for (const corridor of valid) {
        const existing = await db
          .select({ id: autonomousCorridorCoverage.id })
          .from(autonomousCorridorCoverage)
          .where(eq(autonomousCorridorCoverage.carrierId, carrier.id))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(autonomousCorridorCoverage).values({
            id: randomUUID(),
            carrierId: carrier.id,
            originRegion: corridor.originRegion,
            destRegion: corridor.destRegion,
            highwayId: corridor.highwayId ?? null,
            isCertified: corridor.isCertified,
            maxDailyLoads: corridor.maxDailyLoads ?? null,
            coverageStartedAt: new Date(),
          });
        }
      }

      // Update fleet profile sync time + live metrics
      await db
        .update(autonomousFleetProfiles)
        .set({
          ...(data.fleetSize != null ? { activeTruckCount: data.fleetSize } : {}),
          ...(data.uptimeSlaPercent != null ? { uptimeSlaPercent: data.uptimeSlaPercent } : {}),
          ...(data.driverlessMilesPerIncident != null ? { driverlessMilesPerIncident: data.driverlessMilesPerIncident } : {}),
          lastSyncedAt: data.scrapedAt,
          updatedAt: new Date(),
        })
        .where(eq(autonomousFleetProfiles.carrierId, carrier.id));

      // Staleness check
      const ageMs = Date.now() - data.scrapedAt.getTime();
      let staleFlag: string | undefined;
      if (ageMs > PAGE_STALE_MS) {
        staleFlag = "critical";
        console.error(`[carrier-sync] CRITICAL: ${carrier.name} data is >14 days stale — paging on-call`);
      } else if (ageMs > WARN_STALE_MS) {
        staleFlag = "warn";
        console.warn(`[carrier-sync] WARN: ${carrier.name} data is >7 days stale`);
      }

      results[carrier.name] = {
        corridors: valid.length,
        quarantined: quarantined.length,
        source: data.source,
        stale: staleFlag,
      };
    } catch (err) {
      console.error(`[carrier-sync] Error syncing ${carrier.name}:`, err);
      results[carrier.name] = { corridors: 0, quarantined: 0, source: "error" };
    }
  }

  console.log("[carrier-sync] Completed:", JSON.stringify(results));
  return Response.json({ ok: true, results, syncedAt: new Date().toISOString() });
}
