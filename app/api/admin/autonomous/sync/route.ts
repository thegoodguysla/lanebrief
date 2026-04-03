import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { autonomousFleetProfiles, autonomousCorridorCoverage } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { syncFmcsaData } from "@/lib/autonomous/fmcsa-sync";

// POST /api/admin/autonomous/sync
// Manually trigger FMCSA data sync or override specific carrier fields
// Also supports GET to read current sync status

const ADMIN_USER_IDS = (process.env.ADMIN_CLERK_USER_IDS ?? "").split(",").filter(Boolean);

async function assertAdmin(): Promise<{ userId: string } | null> {
  const { userId } = await auth();
  if (!userId) return null;
  if (ADMIN_USER_IDS.length > 0 && !ADMIN_USER_IDS.includes(userId)) return null;
  return { userId };
}

export async function GET() {
  const admin = await assertAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const profiles = await db
    .select()
    .from(autonomousFleetProfiles)
    .orderBy(autonomousFleetProfiles.updatedAt);

  return Response.json({ profiles });
}

export async function POST(req: Request) {
  const admin = await assertAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    action?: "sync" | "override";
    carrierId?: string;
    overrides?: Partial<{
      fmcsaCertStatus: string;
      certNumber: string;
      uptimeSlaPercent: number;
      driverlessMilesPerIncident: number;
      activeTruckCount: number;
    }>;
  };

  if (!body.action || body.action === "sync") {
    const result = await syncFmcsaData();
    return Response.json({ ok: true, ...result });
  }

  if (body.action === "override") {
    if (!body.carrierId || !body.overrides) {
      return Response.json({ error: "carrierId and overrides required" }, { status: 400 });
    }

    const db = getDb();
    await db
      .update(autonomousFleetProfiles)
      .set({ ...body.overrides, updatedAt: new Date() })
      .where(eq(autonomousFleetProfiles.carrierId, body.carrierId));

    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
