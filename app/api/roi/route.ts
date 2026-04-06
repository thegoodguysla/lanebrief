import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import {
  users,
  lanes,
  rateSnapshots,
  briefs,
  tenderAcceptanceCache,
  capacityHeatmapCache,
} from "@/lib/db/schema";
import { eq, desc, and, gte, inArray } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ROI calculation constants
const MINS_PER_RATE_CHECK = 45; // manual research baseline
const MINS_PER_BRIEF = 120; // 2 hrs to write manually
const BROKER_HOURLY_RATE = 50; // avg freight broker labor cost $/hr
const AVG_LANE_MILES = 500; // default lane length for exposure calc
const PLATFORM_AVG_CHECKS_PER_LANE_PER_WEEK = 3; // industry baseline

export type ActivityEvent = {
  type: "rate_check" | "brief" | "alert";
  label: string;
  detail: string;
  timestamp: string;
};

export type RoiData = {
  weeklyHoursSaved: number;
  monthlyHoursSaved: number;
  rateExposureFlagged: number;
  tendersProtected: number;
  capacityWarnings: number;
  briefsGenerated: number;
  activityFeed: ActivityEvent[];
  benchmarkRatio: number;
  monthlyRoiEstimate: number;
  snapshotCount: number;
  laneCount: number;
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const db = getDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const userLanes = await db
    .select()
    .from(lanes)
    .where(eq(lanes.userId, user.id));
  const laneIds = userLanes.map((l) => l.id);

  const empty: RoiData = {
    weeklyHoursSaved: 0,
    monthlyHoursSaved: 0,
    rateExposureFlagged: 0,
    tendersProtected: 0,
    capacityWarnings: 0,
    briefsGenerated: 0,
    activityFeed: [],
    benchmarkRatio: 1.0,
    monthlyRoiEstimate: 0,
    snapshotCount: 0,
    laneCount: 0,
  };

  if (laneIds.length === 0) return Response.json(empty);

  const [snapshots, recentBriefs, tenderData, capacityData] = await Promise.all([
    db
      .select()
      .from(rateSnapshots)
      .where(
        and(
          inArray(rateSnapshots.laneId, laneIds),
          gte(rateSnapshots.generatedAt, thirtyDaysAgo)
        )
      )
      .orderBy(desc(rateSnapshots.generatedAt)),
    db
      .select()
      .from(briefs)
      .where(
        and(eq(briefs.userId, user.id), gte(briefs.generatedAt, thirtyDaysAgo))
      )
      .orderBy(desc(briefs.generatedAt)),
    db
      .select()
      .from(tenderAcceptanceCache)
      .where(inArray(tenderAcceptanceCache.laneId, laneIds)),
    db
      .select()
      .from(capacityHeatmapCache)
      .where(inArray(capacityHeatmapCache.laneId, laneIds)),
  ]);

  // Hours saved
  const weeklySnapshots = snapshots.filter(
    (s) => new Date(s.generatedAt) >= sevenDaysAgo
  );
  const weeklyBriefs = recentBriefs.filter(
    (b) => new Date(b.generatedAt) >= sevenDaysAgo
  );
  const weeklyMinsSaved =
    weeklySnapshots.length * MINS_PER_RATE_CHECK +
    weeklyBriefs.length * MINS_PER_BRIEF;
  const weeklyHoursSaved = Math.round((weeklyMinsSaved / 60) * 10) / 10;

  const monthlyMinsSaved =
    snapshots.length * MINS_PER_RATE_CHECK +
    recentBriefs.length * MINS_PER_BRIEF;
  const monthlyHoursSaved = Math.round((monthlyMinsSaved / 60) * 10) / 10;

  // Rate exposure flagged — snapshots that crossed alert threshold
  const laneThresholdMap = new Map(
    userLanes.map((l) => [l.id, l.alertThresholdPct])
  );
  let totalExposureUsd = 0;
  const alertedSnaps = snapshots.filter((s) => {
    const threshold = laneThresholdMap.get(s.laneId) ?? 5;
    return Math.abs(s.deltaPct) >= threshold;
  });
  for (const snap of alertedSnaps) {
    totalExposureUsd +=
      Math.abs(snap.deltaPct / 100) * snap.marketAvgUsdPerMile * AVG_LANE_MILES;
  }
  const rateExposureFlagged = Math.round(totalExposureUsd);

  // Tenders protected
  const tendersProtected = tenderData.filter(
    (t) => t.riskLevel === "high" || t.riskLevel === "medium"
  ).length;

  // Capacity warnings
  const capacityWarnings = capacityData.filter(
    (c) => c.capacityLevel === "tight"
  ).length;

  // Activity feed — most recent 10 events across rate checks, alerts, briefs
  const feedEvents: ActivityEvent[] = [];

  for (const snap of snapshots.slice(0, 8)) {
    const lane = userLanes.find((l) => l.id === snap.laneId);
    if (!lane) continue;
    const threshold = laneThresholdMap.get(snap.laneId) ?? 5;
    const isAlert = Math.abs(snap.deltaPct) >= threshold;
    feedEvents.push({
      type: isAlert ? "alert" : "rate_check",
      label: `${lane.origin} → ${lane.destination}`,
      detail: isAlert
        ? `Rate moved ${snap.deltaPct > 0 ? "+" : ""}${snap.deltaPct.toFixed(1)}% — alert triggered`
        : `Rate checked: $${snap.marketAvgUsdPerMile.toFixed(2)}/mi`,
      timestamp:
        snap.generatedAt instanceof Date
          ? snap.generatedAt.toISOString()
          : snap.generatedAt,
    });
  }

  for (const brief of recentBriefs.slice(0, 4)) {
    const lane = brief.laneId
      ? userLanes.find((l) => l.id === brief.laneId)
      : null;
    feedEvents.push({
      type: "brief",
      label: lane ? `${lane.origin} → ${lane.destination}` : "All lanes",
      detail: brief.title,
      timestamp:
        brief.generatedAt instanceof Date
          ? brief.generatedAt.toISOString()
          : brief.generatedAt,
    });
  }

  feedEvents.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Benchmark
  const platformAvgWeekly =
    userLanes.length * PLATFORM_AVG_CHECKS_PER_LANE_PER_WEEK;
  const benchmarkRatio =
    platformAvgWeekly > 0
      ? Math.round((weeklySnapshots.length / platformAvgWeekly) * 10) / 10
      : 1.0;

  // Monthly ROI estimate = labor savings + 30% of flagged exposure (assumed acted-on)
  const laborSavingsUsd = (monthlyMinsSaved / 60) * BROKER_HOURLY_RATE;
  const marginProtectionUsd = rateExposureFlagged * 0.3;
  const monthlyRoiEstimate = Math.round(laborSavingsUsd + marginProtectionUsd);

  const data: RoiData = {
    weeklyHoursSaved,
    monthlyHoursSaved,
    rateExposureFlagged,
    tendersProtected,
    capacityWarnings,
    briefsGenerated: recentBriefs.length,
    activityFeed: feedEvents.slice(0, 10),
    benchmarkRatio,
    monthlyRoiEstimate,
    snapshotCount: snapshots.length,
    laneCount: laneIds.length,
  };

  return Response.json(data);
}
