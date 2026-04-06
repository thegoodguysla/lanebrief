import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, lanes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  detectUSMXCrossing,
  getLiveDelayResult,
  getPatternDelayResult,
  type BorderDelayResult,
} from "@/lib/border-delay";

// CBP Border Wait Time API — public, no auth required
// Updates approximately every 15-30 minutes
const CBP_BWT_API = "https://bwt.cbp.gov/api/bwtwaittimes";

type CBPEntry = {
  port_number?: string;
  port_name?: string;
  commercial_vehicle_lanes?: {
    standard_lanes?: {
      delay_minutes?: number | null;
      lanes_open?: number;
    } | null;
  } | null;
};

async function fetchCBPWaitMinutes(portCode: string): Promise<number | null> {
  try {
    const res = await fetch(CBP_BWT_API, {
      next: { revalidate: 900 }, // cache 15 minutes
    });
    if (!res.ok) return null;
    const data: CBPEntry[] = await res.json();
    for (const entry of data) {
      if (entry.port_number === portCode) {
        const delay = entry.commercial_vehicle_lanes?.standard_lanes?.delay_minutes;
        if (typeof delay === "number" && delay >= 0) return delay;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: laneId } = await params;
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const [lane] = await db
    .select()
    .from(lanes)
    .where(and(eq(lanes.id, laneId), eq(lanes.userId, user.id)))
    .limit(1);
  if (!lane) return Response.json({ error: "Lane not found" }, { status: 404 });

  // Non-US-MX lanes: return normal immediately
  const crossing = detectUSMXCrossing(lane);
  if (!crossing) {
    return Response.json({
      riskLevel: "normal",
      crossingPoint: null,
      waitMinutes: null,
      patternNote: null,
      tariffCategoryFlag: false,
    } satisfies BorderDelayResult);
  }

  // Attempt live CBP data first
  const liveWait = await fetchCBPWaitMinutes(crossing.portCode);
  if (liveWait !== null) {
    return Response.json(getLiveDelayResult(liveWait, crossing, lane) satisfies BorderDelayResult);
  }

  // Fallback: historical pattern-based scoring
  return Response.json(getPatternDelayResult(lane) satisfies BorderDelayResult);
}
