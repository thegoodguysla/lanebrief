import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, lanes, rateSnapshots, laneRateForecasts } from "@/lib/db/schema";
import { eq, and, desc, count, gte } from "drizzle-orm";
import { generateText } from "ai";
import { randomUUID } from "crypto";

// Minimum history required for a forecast
const MIN_HISTORY_DAYS = 30;
// Forecast cache TTL: 24 hours
const FORECAST_TTL_MS = 24 * 60 * 60 * 1000;

type ForecastDirection = "up" | "down" | "flat";
type ForecastConfidence = "high" | "medium" | "low";

type ForecastResponse =
  | {
      laneId: string;
      forecast: {
        direction: ForecastDirection;
        pctChange: number;
        confidence: ForecastConfidence;
        reasoning: string;
        horizon: "7d";
        generatedAt: string;
      };
      insufficientData: false;
    }
  | {
      laneId: string;
      forecast: null;
      insufficientData: true;
      reason: string;
    };

function buildForecastPrompt(
  origin: string,
  destination: string,
  equipment: string,
  snapshots: { ratePerMile: number; deltaPct: number; generatedAt: Date }[]
): string {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();

  // Build a compact rate history summary
  const sorted = [...snapshots].sort(
    (a, b) => a.generatedAt.getTime() - b.generatedAt.getTime()
  );
  const oldest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const avgRate =
    sorted.reduce((s, r) => s + r.ratePerMile, 0) / sorted.length;
  const recent = sorted.slice(-7);
  const recentAvg =
    recent.reduce((s, r) => s + r.ratePerMile, 0) / recent.length;
  const trend = recentAvg - avgRate;

  const historyLines = sorted
    .slice(-14) // last 14 data points
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

Using this historical data plus your knowledge of freight market seasonality, carrier capacity trends, tariff signals, and lane characteristics, forecast the rate direction over the next 7 days.

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "direction": <"up" | "down" | "flat">,
  "pct_change": <float, estimated % change over 7 days, positive=up, negative=down, 0=flat; range -15 to +15>,
  "confidence": <"high" | "medium" | "low">,
  "reasoning": "<2-3 sentence explanation specific to this lane and current market conditions>"
}

Rules:
- direction "flat" = pct_change between -1 and +1
- direction "up" = pct_change > 1
- direction "down" = pct_change < -1
- confidence "high" = strong trend signal with low variance; "medium" = moderate signals; "low" = mixed/unclear signals
- Be realistic and specific to this lane corridor`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { id: laneId } = await params;

  // Verify lane belongs to user
  const [lane] = await db
    .select()
    .from(lanes)
    .where(and(eq(lanes.id, laneId), eq(lanes.userId, user.id)))
    .limit(1);
  if (!lane) return Response.json({ error: "Lane not found" }, { status: 404 });

  // Check for a valid cached forecast
  const [cached] = await db
    .select()
    .from(laneRateForecasts)
    .where(eq(laneRateForecasts.laneId, laneId))
    .orderBy(desc(laneRateForecasts.generatedAt))
    .limit(1);

  if (cached && cached.expiresAt.getTime() > Date.now()) {
    return Response.json({
      laneId,
      forecast: {
        direction: cached.direction as ForecastDirection,
        pctChange: cached.pctChange,
        confidence: cached.confidence as ForecastConfidence,
        reasoning: cached.reasoning,
        horizon: "7d",
        generatedAt: cached.generatedAt.toISOString(),
      },
      insufficientData: false,
    } satisfies ForecastResponse);
  }

  // Check history depth
  const thirtyDaysAgo = new Date(Date.now() - MIN_HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const [{ value: snapshotCount }] = await db
    .select({ value: count() })
    .from(rateSnapshots)
    .where(
      and(
        eq(rateSnapshots.laneId, laneId),
        gte(rateSnapshots.generatedAt, thirtyDaysAgo)
      )
    );

  if (snapshotCount < MIN_HISTORY_DAYS) {
    return Response.json({
      laneId,
      forecast: null,
      insufficientData: true,
      reason: `Insufficient data (${snapshotCount} of ${MIN_HISTORY_DAYS} days required)`,
    } satisfies ForecastResponse);
  }

  // Fetch rate history for AI
  const history = await db
    .select({
      ratePerMile: rateSnapshots.ratePerMile,
      deltaPct: rateSnapshots.deltaPct,
      generatedAt: rateSnapshots.generatedAt,
    })
    .from(rateSnapshots)
    .where(eq(rateSnapshots.laneId, laneId))
    .orderBy(desc(rateSnapshots.generatedAt))
    .limit(90);

  // Generate AI forecast
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
    console.error("[forecast] AI error:", err);
    return Response.json({ error: "AI service unavailable" }, { status: 503 });
  }

  const direction = (["up", "down", "flat"].includes(parsed.direction)
    ? parsed.direction
    : "flat") as ForecastDirection;
  const pctChange = Math.max(-15, Math.min(15, parsed.pct_change ?? 0));
  const confidence = (["high", "medium", "low"].includes(parsed.confidence)
    ? parsed.confidence
    : "medium") as ForecastConfidence;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + FORECAST_TTL_MS);

  // Delete old forecast for this lane and insert fresh
  if (cached) {
    await db
      .delete(laneRateForecasts)
      .where(eq(laneRateForecasts.id, cached.id));
  }

  await db.insert(laneRateForecasts).values({
    id: randomUUID(),
    laneId,
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

  return Response.json({
    laneId,
    forecast: {
      direction,
      pctChange,
      confidence,
      reasoning: parsed.reasoning,
      horizon: "7d",
      generatedAt: now.toISOString(),
    },
    insufficientData: false,
  } satisfies ForecastResponse);
}
