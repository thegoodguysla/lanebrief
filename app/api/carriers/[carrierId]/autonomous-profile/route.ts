import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { carriers, autonomousFleetProfiles, autonomousCorridorCoverage } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/carriers/:carrierId/autonomous-profile
// Returns detailed autonomous profile + corridors for a specific carrier

export async function GET(req: Request, { params }: { params: Promise<{ carrierId: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { carrierId } = await params;
  const db = getDb();

  const [carrier] = await db
    .select()
    .from(carriers)
    .where(eq(carriers.id, carrierId))
    .limit(1);

  if (!carrier) return Response.json({ error: "Carrier not found" }, { status: 404 });

  const [profile] = await db
    .select()
    .from(autonomousFleetProfiles)
    .where(eq(autonomousFleetProfiles.carrierId, carrierId))
    .limit(1);

  const corridors = await db
    .select()
    .from(autonomousCorridorCoverage)
    .where(eq(autonomousCorridorCoverage.carrierId, carrierId));

  return Response.json({ carrier, profile: profile ?? null, corridors });
}
