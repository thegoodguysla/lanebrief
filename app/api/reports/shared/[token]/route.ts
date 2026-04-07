import { getDb } from "@/lib/db";
import { reportShares, users, lanes, rateSnapshots, tenderAcceptanceCache, capacityHeatmapCache } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { buildIntelligenceReportHtml } from "@/app/api/cron/weekly-intelligence-report/route";
import type { LaneBrief } from "@/app/api/cron/weekly-intelligence-report/route";

const MX_HIGH_RISK = ["nuevo laredo", "laredo", "ciudad juarez", "ciudad juárez", "juarez", "juárez", "el paso", "reynosa", "pharr", "mcallen", "piedras negras", "eagle pass", "ciudad acuna", "ciudad acuña", "del rio", "nogales", "otay mesa", "tijuana"];
const MX_MEDIUM_RISK = ["calexico", "mexicali"];
const MX_GENERAL = ["mexico", " mx", ",mx", "monterrey", "guadalajara", "cdmx", "mexico city", "matamoros", "saltillo", "hermosillo", "chihuahua", "torreon"];
const CA_HIGH_RISK = ["detroit", "windsor", "port huron", "sarnia"];
const CA_MEDIUM_RISK = ["buffalo", "fort erie", "blaine", "surrey", "pembina", "emerson", "sweetgrass", "coutts"];
const CA_GENERAL = ["canada", "ontario", "quebec", "british columbia", "alberta", "manitoba", "saskatchewan", "nova scotia", "new brunswick", "prince edward island", "newfoundland", " on,", " qc,", " ab,", " mb,", " sk,", " ns,", " nb,", " pe,", " nl,", "toronto", "montreal", "vancouver", "calgary", "edmonton", "ottawa", "winnipeg", "halifax", "hamilton", "london, on", "kitchener"];

function getTariffFlag(origin: string, destination: string): LaneBrief["tariffFlag"] {
  const text = `${origin} ${destination}`.toLowerCase();
  if (MX_HIGH_RISK.some((kw) => text.includes(kw))) return "MX-high";
  if (CA_HIGH_RISK.some((kw) => text.includes(kw))) return "CA-high";
  if (MX_MEDIUM_RISK.some((kw) => text.includes(kw))) return "MX-medium";
  if (CA_MEDIUM_RISK.some((kw) => text.includes(kw))) return "CA-medium";
  if (MX_GENERAL.some((kw) => text.includes(kw))) return "MX-medium";
  if (CA_GENERAL.some((kw) => text.includes(kw))) return "CA-medium";
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const db = getDb();

  const [share] = await db
    .select()
    .from(reportShares)
    .where(eq(reportShares.shareToken, token))
    .limit(1);

  if (!share) {
    return Response.json({ error: "Share not found" }, { status: 404 });
  }

  if (share.expiresAt < new Date()) {
    return Response.json({ error: "Share link expired" }, { status: 410 });
  }

  // Get referrer's user info
  const [dbUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, share.referrerUserId))
    .limit(1);

  // Get referrer's lanes (top 5)
  const userLanes = await db
    .select()
    .from(lanes)
    .where(eq(lanes.userId, share.referrerUserId))
    .limit(5);

  if (userLanes.length === 0) {
    return Response.json({ error: "No lane data available" }, { status: 404 });
  }

  const laneIds = userLanes.map((l) => l.id);

  const [capacityRows, tenderRows, snapRows] = await Promise.all([
    db.select().from(capacityHeatmapCache).where(inArray(capacityHeatmapCache.laneId, laneIds)).orderBy(desc(capacityHeatmapCache.generatedAt)),
    db.select().from(tenderAcceptanceCache).where(inArray(tenderAcceptanceCache.laneId, laneIds)).orderBy(desc(tenderAcceptanceCache.generatedAt)),
    db.select().from(rateSnapshots).where(inArray(rateSnapshots.laneId, laneIds)).orderBy(desc(rateSnapshots.generatedAt)),
  ]);

  const capacityByLane = new Map(
    capacityRows.reduce<[string, typeof capacityRows[0]][]>((acc, r) => {
      if (!acc.find(([id]) => id === r.laneId)) acc.push([r.laneId, r]);
      return acc;
    }, [])
  );
  const tenderByLane = new Map(
    tenderRows.reduce<[string, typeof tenderRows[0]][]>((acc, r) => {
      if (!acc.find(([id]) => id === r.laneId)) acc.push([r.laneId, r]);
      return acc;
    }, [])
  );
  const snapByLane = new Map(
    snapRows.reduce<[string, typeof snapRows[0]][]>((acc, r) => {
      if (!acc.find(([id]) => id === r.laneId)) acc.push([r.laneId, r]);
      return acc;
    }, [])
  );

  const briefLanes: LaneBrief[] = userLanes.map((lane) => {
    const snap = snapByLane.get(lane.id);
    const cap = capacityByLane.get(lane.id);
    const tender = tenderByLane.get(lane.id);
    const rate = snap?.marketAvgUsdPerMile ?? 2.5;

    return {
      origin: lane.origin,
      destination: lane.destination,
      equipment: lane.equipment,
      rateSummary: `$${rate.toFixed(2)}/mi`,
      rateUsdPerMile: rate,
      deltaPct: snap?.deltaPct ?? null,
      capacitySignal: cap ? (cap.capacityLevel as LaneBrief["capacitySignal"]) : null,
      tenderRisk: tender ? (tender.riskLevel as LaneBrief["tenderRisk"]) : null,
      tenderAcceptancePct: tender?.estimatedAcceptancePct ?? null,
      tariffFlag: getTariffFlag(lane.origin, lane.destination),
      carrierRecommendation: cap?.reasoning ? cap.reasoning.slice(0, 80) : "Check regional carriers for best rates on this lane",
      aiSummary: `Current market conditions for ${lane.origin} → ${lane.destination}`,
    };
  });

  const reportHtml = buildIntelligenceReportHtml(briefLanes);

  return Response.json({
    referrerEmail: dbUser?.email ?? null,
    expiresAt: share.expiresAt,
    reportHtml,
    laneCount: briefLanes.length,
  });
}
