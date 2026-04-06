import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, lanes, capacityHeatmapCache } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateText } from "ai";
import { randomUUID } from "crypto";

// Cache TTL: 7 days
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CapacityLevel = "tight" | "moderate" | "loose";

export type CapacityHeatmapResponse = {
  laneId: string;
  capacityLevel: CapacityLevel;
  estimatedCarrierCount: number;
  reasoning: string;
  alternatives: Array<{ origin: string; destination: string; reason: string }>;
  confidence: "ai_estimated";
  cachedAt: string | null;
};

function buildPrompt(origin: string, destination: string, equipment: string): string {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();

  return `You are a freight capacity analyst. Estimate carrier capacity for a ${equipment.replace("_", " ")} load from ${origin} to ${destination} in ${month} ${year}.

Consider: lane balance, density of trucking operations in the corridor, typical carrier count for this market, seasonal demand shifts, and whether this is a head-haul or back-haul lane.

Also suggest 2-3 alternative nearby lanes that typically have MORE available capacity, in case this lane is tight.

Respond with ONLY a JSON object (no markdown):
{
  "estimated_carrier_count": <integer, active carriers regularly running this lane>,
  "capacity_level": <"tight" | "moderate" | "loose">,
  "reasoning": "<2 sentence explanation of capacity conditions on this lane>",
  "alternatives": [
    {"origin": "<city, ST>", "destination": "<city, ST>", "reason": "<why this alt has more capacity, 8 words max>"},
    {"origin": "<city, ST>", "destination": "<city, ST>", "reason": "<why this alt has more capacity, 8 words max>"},
    {"origin": "<city, ST>", "destination": "<city, ST>", "reason": "<why this alt has more capacity, 8 words max>"}
  ]
}

Rules:
- estimated_carrier_count: realistic integer (tight lanes: 2-4, moderate: 5-12, loose: 13+)
- capacity_level: "tight" if count ≤ 4, "moderate" if 5-12, "loose" if 13+
- reasoning: mention specific corridor characteristics (back-haul imbalance, density, equipment demand)
- alternatives: exactly 3 nearby alternatives with more capacity; keep origin/destination as real US city pairs
- Be realistic and specific to this geographic corridor`;
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

  // Check cache
  const [cached] = await db
    .select()
    .from(capacityHeatmapCache)
    .where(eq(capacityHeatmapCache.laneId, laneId))
    .orderBy(desc(capacityHeatmapCache.generatedAt))
    .limit(1);

  if (cached) {
    const age = Date.now() - cached.generatedAt.getTime();
    if (age < CACHE_TTL_MS) {
      return Response.json({
        laneId,
        capacityLevel: cached.capacityLevel as CapacityLevel,
        estimatedCarrierCount: cached.estimatedCarrierCount,
        reasoning: cached.reasoning,
        alternatives: JSON.parse(cached.alternatives) as CapacityHeatmapResponse["alternatives"],
        confidence: "ai_estimated",
        cachedAt: cached.generatedAt.toISOString(),
      } satisfies CapacityHeatmapResponse);
    }
  }

  // Call AI
  let parsed: {
    estimated_carrier_count: number;
    capacity_level: string;
    reasoning: string;
    alternatives: Array<{ origin: string; destination: string; reason: string }>;
  };

  try {
    const { text } = await generateText({
      model: "anthropic/claude-haiku-4.5",
      prompt: buildPrompt(lane.origin, lane.destination, lane.equipment),
      maxOutputTokens: 512,
    });

    let cleaned = text.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) cleaned = fenceMatch[1].trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("[capacity-heatmap] AI error:", err);
    return Response.json({ error: "AI service unavailable" }, { status: 503 });
  }

  const count = Math.max(1, Math.round(parsed.estimated_carrier_count ?? 5));
  const capacityLevel: CapacityLevel =
    count <= 4 ? "tight" : count <= 12 ? "moderate" : "loose";
  const alternatives = (parsed.alternatives ?? []).slice(0, 3);

  // Upsert cache
  if (cached) {
    await db.delete(capacityHeatmapCache).where(eq(capacityHeatmapCache.id, cached.id));
  }
  await db.insert(capacityHeatmapCache).values({
    id: randomUUID(),
    laneId,
    origin: lane.origin,
    destination: lane.destination,
    equipment: lane.equipment,
    capacityLevel,
    estimatedCarrierCount: count,
    reasoning: parsed.reasoning,
    alternatives: JSON.stringify(alternatives),
    generatedAt: new Date(),
  });

  return Response.json({
    laneId,
    capacityLevel,
    estimatedCarrierCount: count,
    reasoning: parsed.reasoning,
    alternatives,
    confidence: "ai_estimated",
    cachedAt: null,
  } satisfies CapacityHeatmapResponse);
}
