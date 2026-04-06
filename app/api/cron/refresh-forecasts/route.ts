import { getDb } from "@/lib/db";
import { lanes, rateSnapshots, laneRateForecasts } from "@/lib/db/schema";
import { eq, and, gte, count, desc, lt } from "drizzle-orm";
import { generateText } from "ai";
import { randomUUID } from "crypto";

// Vercel Cron: daily at noon UTC
// vercel.json schedule: "0 12 * * *"

const MIN_HISTORY_DAYS = 30;

type ForecastDirection = "up" | "down" | "flat";
type ForecastConfidence = "high" | "medium" | "low";

function buildForecastPrompt(
  origin: string,
  destination: string,
  equipment: string,
  snapshots: { ratePerMile: number; deltaPct: number; generatedAt: Date }[]
): string {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();

  const sorted = [...snapshots].sort(
    (a, b) => a.generatedAt.getTime() - b.generatedAt.getTime()
  );
  const oldest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const avgRate = sorted.reduce((s, r) => s + r.ratePerMile, 0) / sorted.length;
  const recent = sorted.slice(-7);
  const recentAvg = recent.reduce((s, r) => s + r.ratePerMile, 0) / recent.length;
  const trend = recentAvg - avgRate;

  const historyLines = sorted
    .slice(-14)
    .map(
      (r) =>
        `  ${r.generatedAt.toISOString().slice(0, 10)}: $${r.ratePerMile.toFixed(2)}/mi (delta ${r.deltaPct >= 0 ? "+" : ""}${r.deltaPct.toFixed(1)}%)`
    )
    .join("\n");

  return `You are a freight market analyst. Forecast the 7-day rate direction for the following lane.

Lane: ${equipment.replace(/_/g, " ")} from ${origin} to ${destination}
Month: ${month} ${year}
Data points: ${snapshots.length} daily snapshots
Oldest: ${oldest.generatedAt.toISOString().slice(0, 10)} @ $${oldest.ratePerMile.toFixed(2)}/mi
Latest: ${latest.generatedAt.toISOString().slice(0, 10)} @ $${latest.ratePerMile.toFixed(2)}/mi
30-day avg: $${avgRate.toFixed(2)}/mi
7-day avg: $${recentAvg.toFixed(2)}/mi
Recent trend: ${trend >= 0 ? "+" : ""}${trend.toFixed(2)}/mi vs 30-day avg

Recent rate history (last 14 days):
${historyLines}

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "direction": <"up" | "down" | "flat">,
  "pct_change": <float, estimated % change over 7 days; range -15 to +15>,
  "confidence": <"high" | "medium" | "low">,
  "reasoning": "<2-3 sentence explanation specific to this lane>"
}

Rules:
- direction "flat" = pct_change between -1 and +1
- direction "up" = pct_change > 1
- direction "down" = pct_change < -1
- confidence "high" = strong trend signal; "medium" = moderate signals; "low" = mixed signals`;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = getDb();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - MIN_HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Delete expired forecasts
  await db
    .delete(laneRateForecasts)
    .where(lt(laneRateForecasts.expiresAt, now));

  // Fetch all lanes
  const allLanes = await db.select().from(lanes);

  let refreshed = 0;
  let skipped = 0;

  for (const lane of allLanes) {
    // Count snapshots in last 30 days
    const [{ value: snapshotCount }] = await db
      .select({ value: count() })
      .from(rateSnapshots)
      .where(
        and(
          eq(rateSnapshots.laneId, lane.id),
          gte(rateSnapshots.generatedAt, thirtyDaysAgo)
        )
      );

    if (snapshotCount < MIN_HISTORY_DAYS) {
      skipped++;
      continue;
    }

    // Check if a fresh forecast already exists
    const [existing] = await db
      .select()
      .from(laneRateForecasts)
      .where(eq(laneRateForecasts.laneId, lane.id))
      .orderBy(desc(laneRateForecasts.generatedAt))
      .limit(1);

    if (existing && existing.expiresAt.getTime() > now.getTime()) {
      skipped++;
      continue;
    }

    // Fetch rate history
    const history = await db
      .select({
        ratePerMile: rateSnapshots.ratePerMile,
        deltaPct: rateSnapshots.deltaPct,
        generatedAt: rateSnapshots.generatedAt,
      })
      .from(rateSnapshots)
      .where(eq(rateSnapshots.laneId, lane.id))
      .orderBy(desc(rateSnapshots.generatedAt))
      .limit(90);

    // Call AI
    let parsed: {
      direction: string;
      pct_change: number;
      confidence: string;
      reasoning: string;
    };
    try {
      const { text } = await generateText({
        model: "anthropic/claude-haiku-4.5",
        prompt: buildForecastPrompt(lane.origin, lane.destination, lane.equipment, history),
        maxOutputTokens: 256,
      });

      let cleaned = text.trim();
      const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) cleaned = fenceMatch[1].trim();
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error(`[refresh-forecasts] AI error for lane ${lane.id}:`, err);
      continue;
    }

    const direction = (["up", "down", "flat"].includes(parsed.direction)
      ? parsed.direction
      : "flat") as ForecastDirection;
    const pctChange = Math.max(-15, Math.min(15, parsed.pct_change ?? 0));
    const confidence = (["high", "medium", "low"].includes(parsed.confidence)
      ? parsed.confidence
      : "medium") as ForecastConfidence;

    // Delete old forecast and insert fresh
    if (existing) {
      await db
        .delete(laneRateForecasts)
        .where(eq(laneRateForecasts.id, existing.id));
    }

    await db.insert(laneRateForecasts).values({
      id: randomUUID(),
      laneId: lane.id,
      origin: lane.origin,
      destination: lane.destination,
      equipment: lane.equipment,
      direction,
      pctChange,
      confidence,
      reasoning: parsed.reasoning,
      generatedAt: now,
      expiresAt,
    });

    refreshed++;
  }

  return Response.json({
    ok: true,
    message: `Forecast refresh complete`,
    lanesChecked: allLanes.length,
    forecastsRefreshed: refreshed,
    skipped,
  });
}
