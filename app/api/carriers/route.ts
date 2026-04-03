import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { carriers, autonomousFleetProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/carriers?type=autonomous_fleet_operator
// Returns carrier list, optionally filtered by type

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  const db = getDb();

  const rows = await db
    .select({
      id: carriers.id,
      name: carriers.name,
      type: carriers.type,
      dotNumber: carriers.dotNumber,
      website: carriers.website,
      fmcsaCertStatus: autonomousFleetProfiles.fmcsaCertStatus,
      uptimeSlaPercent: autonomousFleetProfiles.uptimeSlaPercent,
      driverlessMilesPerIncident: autonomousFleetProfiles.driverlessMilesPerIncident,
      activeTruckCount: autonomousFleetProfiles.activeTruckCount,
      lastSyncedAt: autonomousFleetProfiles.lastSyncedAt,
    })
    .from(carriers)
    .leftJoin(autonomousFleetProfiles, eq(autonomousFleetProfiles.carrierId, carriers.id))
    .where(type ? eq(carriers.type, type) : undefined);

  return Response.json({ carriers: rows });
}
