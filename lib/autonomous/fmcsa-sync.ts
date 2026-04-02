import { getDb } from "@/lib/db";
import {
  carriers,
  autonomousFleetProfiles,
  autonomousCorridorCoverage,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { AUTONOMOUS_CARRIER_SEED } from "./seed-data";

// FMCSA AV Certification API
// Base: https://ai.fmcsa.dot.gov/SMS — rate limit 50 req/min
// Falls back to seed data if API is unavailable or returns no results

interface FmcsaAvRecord {
  dotNumber: string;
  carrierName: string;
  certStatus: "certified" | "provisional" | "none";
  certNumber: string | null;
  certExpiry: Date | null;
}

async function fetchFmcsaAvRecords(): Promise<FmcsaAvRecord[]> {
  try {
    const url = new URL("https://ai.fmcsa.dot.gov/SMS/Carrier/GetCarrierBasics");
    url.searchParams.set("exemptionType", "AV");
    url.searchParams.set("output", "json");

    const res = await fetch(url.toString(), {
      headers: { "Accept": "application/json", "User-Agent": "LaneBrief-DataSync/1.0" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`FMCSA API ${res.status}`);

    const data = await res.json() as { content?: unknown[] };
    if (!Array.isArray(data.content) || data.content.length === 0) return [];

    return (data.content as Record<string, unknown>[]).map((item) => ({
      dotNumber: String(item.dotNumber ?? ""),
      carrierName: String(item.legalName ?? item.dbaName ?? ""),
      certStatus: item.avCertStatus === "C" ? "certified" : item.avCertStatus === "P" ? "provisional" : "none",
      certNumber: item.avExemptionNumber ? String(item.avExemptionNumber) : null,
      certExpiry: item.avExpirationDate ? new Date(String(item.avExpirationDate)) : null,
    }));
  } catch {
    // FMCSA API unavailable — fall through to seed data
    return [];
  }
}

export async function syncFmcsaData(): Promise<{
  upserted: number;
  stale: boolean;
  source: "fmcsa_api" | "seed_data";
}> {
  const db = getDb();

  // Try live FMCSA API first
  const liveRecords = await fetchFmcsaAvRecords();
  const source = liveRecords.length > 0 ? "fmcsa_api" : "seed_data";

  // Ensure seed carriers exist (always run to populate initial data)
  for (const seed of AUTONOMOUS_CARRIER_SEED) {
    const [existing] = await db
      .select()
      .from(carriers)
      .where(eq(carriers.name, seed.carrier.name))
      .limit(1);

    let carrierId: string;

    if (existing) {
      carrierId = existing.id;
      await db
        .update(carriers)
        .set({ updatedAt: new Date() })
        .where(eq(carriers.id, carrierId));
    } else {
      const [created] = await db
        .insert(carriers)
        .values({
          id: randomUUID(),
          name: seed.carrier.name,
          type: "autonomous_fleet_operator",
          dotNumber: seed.carrier.dotNumber,
          website: seed.carrier.website,
        })
        .returning();
      carrierId = created.id;
    }

    // Merge live FMCSA data if available
    const liveRecord = liveRecords.find(
      (r) => r.dotNumber === seed.carrier.dotNumber || r.carrierName.toLowerCase().includes(seed.carrier.name.toLowerCase().split(" ")[0])
    );

    const profileData = liveRecord
      ? {
          fmcsaCertStatus: liveRecord.certStatus,
          certNumber: liveRecord.certNumber,
          certExpiry: liveRecord.certExpiry,
          uptimeSlaPercent: seed.profile.uptimeSlaPercent,
          driverlessMilesPerIncident: seed.profile.driverlessMilesPerIncident,
          activeTruckCount: seed.profile.activeTruckCount,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        }
      : {
          fmcsaCertStatus: seed.profile.fmcsaCertStatus,
          certNumber: seed.profile.certNumber,
          certExpiry: seed.profile.certExpiry,
          uptimeSlaPercent: seed.profile.uptimeSlaPercent,
          driverlessMilesPerIncident: seed.profile.driverlessMilesPerIncident,
          activeTruckCount: seed.profile.activeTruckCount,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        };

    const [existingProfile] = await db
      .select()
      .from(autonomousFleetProfiles)
      .where(eq(autonomousFleetProfiles.carrierId, carrierId))
      .limit(1);

    if (existingProfile) {
      await db
        .update(autonomousFleetProfiles)
        .set(profileData)
        .where(eq(autonomousFleetProfiles.carrierId, carrierId));
    } else {
      await db.insert(autonomousFleetProfiles).values({
        id: randomUUID(),
        carrierId,
        ...profileData,
        createdAt: new Date(),
      });
    }

    // Upsert corridors
    for (const corridor of seed.corridors) {
      const [existingCorridor] = await db
        .select()
        .from(autonomousCorridorCoverage)
        .where(eq(autonomousCorridorCoverage.carrierId, carrierId))
        .limit(1);

      if (!existingCorridor) {
        await db.insert(autonomousCorridorCoverage).values({
          id: randomUUID(),
          carrierId,
          originRegion: corridor.originRegion,
          destRegion: corridor.destRegion,
          highwayId: corridor.highwayId ?? null,
          isCertified: corridor.isCertified,
          maxDailyLoads: corridor.maxDailyLoads ?? null,
          coverageStartedAt: new Date("2024-01-01"),
        });
      }
    }
  }

  // Check staleness: if last sync was >72h ago, flag it
  const [latestProfile] = await db
    .select({ lastSyncedAt: autonomousFleetProfiles.lastSyncedAt })
    .from(autonomousFleetProfiles)
    .orderBy(autonomousFleetProfiles.lastSyncedAt)
    .limit(1);

  const staleThresholdMs = 72 * 60 * 60 * 1000;
  const stale = latestProfile?.lastSyncedAt
    ? Date.now() - latestProfile.lastSyncedAt.getTime() > staleThresholdMs
    : false;

  return { upserted: AUTONOMOUS_CARRIER_SEED.length, stale, source };
}
