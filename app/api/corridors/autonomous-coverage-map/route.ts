import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { carriers, autonomousFleetProfiles, autonomousCorridorCoverage } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/corridors/autonomous-coverage-map
// Returns corridor data for map visualization, optionally filtered by carrier name

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const carrierFilter = searchParams.get("carrier"); // e.g. "Aurora Innovation"

  const db = getDb();

  const allCarriers = await db
    .select({
      id: carriers.id,
      name: carriers.name,
      dotNumber: carriers.dotNumber,
      website: carriers.website,
      fmcsaCertStatus: autonomousFleetProfiles.fmcsaCertStatus,
      uptimeSlaPercent: autonomousFleetProfiles.uptimeSlaPercent,
      activeTruckCount: autonomousFleetProfiles.activeTruckCount,
      lastSyncedAt: autonomousFleetProfiles.lastSyncedAt,
    })
    .from(carriers)
    .leftJoin(autonomousFleetProfiles, eq(autonomousFleetProfiles.carrierId, carriers.id))
    .where(eq(carriers.type, "autonomous_fleet_operator"));

  const filteredCarriers = carrierFilter
    ? allCarriers.filter((c) => c.name.toLowerCase().includes(carrierFilter.toLowerCase()))
    : allCarriers;

  const carrierIds = filteredCarriers.map((c) => c.id);

  const corridors = carrierIds.length > 0
    ? await db
        .select()
        .from(autonomousCorridorCoverage)
        .where(eq(autonomousCorridorCoverage.carrierId, carrierIds[0]))
        .then(async (first) => {
          if (carrierIds.length === 1) return first;
          // Fetch for remaining carriers and merge
          const rest = await Promise.all(
            carrierIds.slice(1).map((id) =>
              db.select().from(autonomousCorridorCoverage).where(eq(autonomousCorridorCoverage.carrierId, id))
            )
          );
          return [...first, ...rest.flat()];
        })
    : [];

  // Attach carrier info to each corridor
  const carrierMap = Object.fromEntries(filteredCarriers.map((c) => [c.id, c]));
  const enrichedCorridors = corridors.map((c) => ({
    ...c,
    carrier: carrierMap[c.carrierId] ?? null,
  }));

  return Response.json({
    carriers: filteredCarriers,
    corridors: enrichedCorridors,
    updatedAt: new Date().toISOString(),
  });
}
