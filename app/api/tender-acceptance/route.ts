import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, lanes, tenderAcceptanceCache } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateText } from "ai";
import { randomUUID } from "crypto";

// Cache TTL: 7 days in milliseconds
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type AcceptanceRisk = "low" | "medium" | "high";

type TenderAcceptanceResponse = {
  laneId: string;
  riskLevel: AcceptanceRisk;
  estimatedAcceptancePct: number;
  reasoning: string;
  factors: string[];
  confidence: "ai_estimated";
  cachedAt: string | null;
};

function buildPrompt(origin: string, destination: string, equipment: string): string {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();

  return `You are a freight market analyst specializing in tender acceptance rates. Estimate the first-tender acceptance rate for a ${equipment.replace("_", " ")} load from ${origin} to ${destination} in ${month} ${year}.

Consider: lane balance (head-haul vs back-haul), carrier availability on this corridor, market tightness, seasonal patterns, and typical spot vs contract dynamics for this lane type.

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "estimated_acceptance_pct": <integer 50–98>,
  "risk_level": <"low" | "medium" | "high">,
  "reasoning": "<2–3 sentence explanation of acceptance risk specific to this lane>",
  "factors": ["<factor 1>", "<factor 2>", "<factor 3>"]
}

Rules:
- estimated_acceptance_pct: percentage of tenders accepted on first tender (50=very low, 85=average, 98=excellent)
- risk_level: "high" if pct < 75, "medium" if 75–87, "low" if >= 88
- reasoning: mention specific lane characteristics (balance, equipment, seasonal demand)
- factors: exactly 3 short phrases (5–10 words each) explaining key drivers
- Be realistic — most lanes score 72–92%`;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!user) return Response.json({ error: "User not found — call /api/user/sync first" }, { status: 404 });

  const body = await req.json() as { laneId: string };
  const { laneId } = body;
  if (!laneId) return Response.json({ error: "laneId required" }, { status: 400 });

  // Verify lane belongs to user
  const [lane] = await db
    .select()
    .from(lanes)
    .where(and(eq(lanes.id, laneId), eq(lanes.userId, user.id)))
    .limit(1);
  if (!lane) return Response.json({ error: "Lane not found" }, { status: 404 });

  // Check cache
  const [cached] = await db
    .select()
    .from(tenderAcceptanceCache)
    .where(eq(tenderAcceptanceCache.laneId, laneId))
    .orderBy(desc(tenderAcceptanceCache.generatedAt))
    .limit(1);

  if (cached) {
    const age = Date.now() - cached.generatedAt.getTime();
    if (age < CACHE_TTL_MS) {
      return Response.json({
        laneId,
        riskLevel: cached.riskLevel as AcceptanceRisk,
        estimatedAcceptancePct: cached.estimatedAcceptancePct,
        reasoning: cached.reasoning,
        factors: JSON.parse(cached.factors) as string[],
        confidence: "ai_estimated",
        cachedAt: cached.generatedAt.toISOString(),
      } satisfies TenderAcceptanceResponse);
    }
  }

  // Call AI
  let parsed: { estimated_acceptance_pct: number; risk_level: string; reasoning: string; factors: string[] };
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
    console.error("[tender-acceptance] AI error:", err);
    return Response.json({ error: "AI service unavailable" }, { status: 503 });
  }

  const pct = Math.max(50, Math.min(99, Math.round(parsed.estimated_acceptance_pct)));
  const riskLevel: AcceptanceRisk =
    pct >= 88 ? "low" : pct >= 75 ? "medium" : "high";

  // Upsert cache (delete old entry for this lane if exists, insert fresh)
  if (cached) {
    await db.delete(tenderAcceptanceCache).where(eq(tenderAcceptanceCache.id, cached.id));
  }

  await db.insert(tenderAcceptanceCache).values({
    id: randomUUID(),
    laneId,
    origin: lane.origin,
    destination: lane.destination,
    equipment: lane.equipment,
    riskLevel,
    estimatedAcceptancePct: pct,
    reasoning: parsed.reasoning,
    factors: JSON.stringify(parsed.factors ?? []),
    generatedAt: new Date(),
  });

  return Response.json({
    laneId,
    riskLevel,
    estimatedAcceptancePct: pct,
    reasoning: parsed.reasoning,
    factors: parsed.factors ?? [],
    confidence: "ai_estimated",
    cachedAt: null,
  } satisfies TenderAcceptanceResponse);
}
