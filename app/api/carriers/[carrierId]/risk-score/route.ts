import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { carriers, carrierRiskCache } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateText } from "ai";
import { randomUUID } from "crypto";

// Cache TTL: 7 days — risk profile changes slowly
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type RiskTier = "low" | "medium" | "high";

export type CarrierRiskScoreResponse = {
  carrierId: string;
  score: number; // 0–100 (higher = riskier for payment fraud/double-brokering)
  tier: RiskTier;
  signals: string[];
  reasoning: string;
  confidence: "ai_estimated";
  disclaimer: string;
  cachedAt: string | null;
};

function scoreToTier(score: number): RiskTier {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function buildPrompt(carrierName: string, dotNumber: string | null): string {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();

  return `You are a freight payment fraud analyst specializing in carrier vetting for brokers. Assess the PAYMENT RISK of carrier "${carrierName}"${dotNumber ? ` (DOT #${dotNumber})` : ""} as of ${month} ${year}.

Payment risk includes: double-brokering risk, carrier identity fraud, factoring company cash-flow stress signals, authority reactivation patterns, and non-payment/chargeback history.

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "score": <integer 0–100, where 100 = maximum payment fraud risk>,
  "signals": ["<signal 1>", "<signal 2>", "<signal 3>"],
  "reasoning": "<2–3 sentences explaining the key risk factors for this carrier>"
}

Rules:
- score: 0 (very low risk) to 100 (very high risk). Most legitimate carriers score 10–40. Double-brokering suspects score 60+. Recently reactivated or shell companies score 70+.
- signals: exactly 3 specific risk signals relevant to this carrier (e.g., "MC authority < 6 months old", "factoring company changed twice in 12 months", "multiple authority revocation/reinstatement events", "no verifiable operating history", "name mimics well-known carrier")
- reasoning: specific, actionable 2–3 sentence assessment. Mention MC age, FMCSA patterns, and cash-flow indicators.
- Be calibrated: established national carriers with long history should score low (5–20), new entrants score medium (30–50), suspicious patterns score high (60–90).`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ carrierId: string }> },
) {
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

  // Check cache
  const [cached] = await db
    .select()
    .from(carrierRiskCache)
    .where(eq(carrierRiskCache.carrierId, carrierId))
    .orderBy(desc(carrierRiskCache.generatedAt))
    .limit(1);

  if (cached) {
    const age = Date.now() - cached.generatedAt.getTime();
    if (age < CACHE_TTL_MS) {
      return Response.json({
        carrierId,
        score: cached.score,
        tier: cached.tier as RiskTier,
        signals: JSON.parse(cached.signals) as string[],
        reasoning: cached.reasoning,
        confidence: "ai_estimated",
        disclaimer:
          "AI-estimated payment risk. Verify with FMCSA SAFER, carrier411, and direct vetting before tendering.",
        cachedAt: cached.generatedAt.toISOString(),
      } satisfies CarrierRiskScoreResponse);
    }
  }

  // Generate fresh risk score
  let parsed: { score: number; signals: string[]; reasoning: string };

  try {
    const { text } = await generateText({
      model: "anthropic/claude-haiku-4.5",
      prompt: buildPrompt(carrier.name, carrier.dotNumber),
      maxOutputTokens: 512,
    });

    let cleaned = text.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) cleaned = fenceMatch[1].trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("[carrier-risk-score] AI error:", err);
    return Response.json({ error: "AI service unavailable" }, { status: 503 });
  }

  const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
  const tier = scoreToTier(score);
  const signals = (parsed.signals ?? []).slice(0, 3);

  // Upsert cache
  if (cached) {
    await db.delete(carrierRiskCache).where(eq(carrierRiskCache.id, cached.id));
  }
  await db.insert(carrierRiskCache).values({
    id: randomUUID(),
    carrierId,
    score,
    tier,
    signals: JSON.stringify(signals),
    reasoning: parsed.reasoning,
    generatedAt: new Date(),
  });

  return Response.json({
    carrierId,
    score,
    tier,
    signals,
    reasoning: parsed.reasoning,
    confidence: "ai_estimated",
    disclaimer:
      "AI-estimated payment risk. Verify with FMCSA SAFER, carrier411, and direct vetting before tendering.",
    cachedAt: null,
  } satisfies CarrierRiskScoreResponse);
}
