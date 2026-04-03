import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, lanes, carriers, autonomousFleetProfiles, autonomousCorridorCoverage } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { checkCorridorCoverage } from "@/lib/autonomous/seed-data";

// GET /api/lanes/:id/autonomous-coverage
// Returns coverage flag (YES/NO/PARTIAL) + list of autonomous carriers serving this lane

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: laneId } = await params;
  const db = getDb();

  // Verify lane belongs to user
  const [user] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const [lane] = await db
    .select()
    .from(lanes)
    .where(and(eq(lanes.id, laneId), eq(lanes.userId, user.id)))
    .limit(1);

  if (!lane) return Response.json({ error: "Lane not found" }, { status: 404 });

  // Get all autonomous corridors
  const corridors = await db
    .select({
      carrierId: autonomousCorridorCoverage.carrierId,
      originRegion: autonomousCorridorCoverage.originRegion,
      destRegion: autonomousCorridorCoverage.destRegion,
      isCertified: autonomousCorridorCoverage.isCertified,
      maxDailyLoads: autonomousCorridorCoverage.maxDailyLoads,
      highwayId: autonomousCorridorCoverage.highwayId,
    })
    .from(autonomousCorridorCoverage);

  const coverage = checkCorridorCoverage(lane.origin, lane.destination, corridors);

  // Find carriers that cover this lane
  const matchingCarrierIds = [
    ...new Set(
      corridors
        .filter((c) => {
          const co = c.originRegion.toLowerCase();
          const cd = c.destRegion.toLowerCase();
          const lo = lane.origin.toLowerCase();
          const ld = lane.destination.toLowerCase();
          return (
            (lo.includes(co.split(",")[0]) || co.includes(lo.split(",")[0])) &&
            (ld.includes(cd.split(",")[0]) || cd.includes(ld.split(",")[0]))
          );
        })
        .map((c) => c.carrierId)
    ),
  ];

  const coveringCarriers =
    matchingCarrierIds.length > 0
      ? await db
          .select({
            id: carriers.id,
            name: carriers.name,
            dotNumber: carriers.dotNumber,
            website: carriers.website,
            fmcsaCertStatus: autonomousFleetProfiles.fmcsaCertStatus,
            uptimeSlaPercent: autonomousFleetProfiles.uptimeSlaPercent,
            driverlessMilesPerIncident: autonomousFleetProfiles.driverlessMilesPerIncident,
            activeTruckCount: autonomousFleetProfiles.activeTruckCount,
          })
          .from(carriers)
          .leftJoin(autonomousFleetProfiles, eq(autonomousFleetProfiles.carrierId, carriers.id))
          .where(eq(carriers.type, "autonomous_fleet_operator"))
      : [];

  const filteredCarriers = coveringCarriers.filter((c) => matchingCarrierIds.includes(c.id));

  return Response.json({
    laneId,
    origin: lane.origin,
    destination: lane.destination,
    coverage,
    carriers: filteredCarriers,
  });
}
