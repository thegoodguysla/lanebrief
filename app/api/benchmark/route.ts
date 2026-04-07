import { generateText } from "ai";
import {
  isTruckstopConfigured,
  getBookedRateEstimate,
} from "@/lib/truckstop";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type BenchmarkRequest = {
  origin: string;
  destination: string;
  rate_per_mile: number;
  equipment: string;
};

type BenchmarkResponse = {
  market_avg_usd_per_mile: number;
  market_low_usd_per_mile?: number;
  market_high_usd_per_mile?: number;
  delta_pct: number;
  verdict: "above_market" | "at_market" | "below_market";
  verdict_label: string;
  confidence: "truckstop_live" | "ai_estimated";
  data_source?: string;
  disclaimer: string;
};

function buildAIPrompt(origin: string, destination: string, ratePpm: number, equipment: string): string {
  const now = new Date();
  const month = MONTH_NAMES[now.getMonth()];
  const year = now.getFullYear();

  return `You are a freight market analyst. Estimate the current spot market rate per mile for a ${equipment} truck load from ${origin} to ${destination} in ${month} ${year}.

Consider: typical lane supply/demand, seasonal patterns for this month, fuel costs, and regional capacity.

The broker is quoting $${ratePpm.toFixed(2)}/mile. Compare this to your market estimate.

Respond with ONLY a JSON object (no markdown, no explanation) in this exact format:
{
  "market_avg_usd_per_mile": <number>,
  "delta_pct": <number, positive means above market, negative means below>,
  "verdict": <"above_market" | "at_market" | "below_market">,
  "verdict_label": <short 6-10 word label>
}

Rules:
- market_avg_usd_per_mile: realistic spot rate estimate, 2 decimal places
- delta_pct: ((${ratePpm} - market_avg) / market_avg) * 100, rounded to 1 decimal
- verdict: above_market if delta_pct > 3, below_market if delta_pct < -3, otherwise at_market
- verdict_label: concise, specific (e.g. "Competitive rate for this corridor", "You may be leaving money on the table")`;
}

function computeVerdict(ratePpm: number, marketAvg: number): {
  delta_pct: number;
  verdict: "above_market" | "at_market" | "below_market";
} {
  const delta_pct = parseFloat(((ratePpm - marketAvg) / marketAvg * 100).toFixed(1));
  const verdict = delta_pct > 3 ? "above_market" : delta_pct < -3 ? "below_market" : "at_market";
  return { delta_pct, verdict };
}

function verdictLabel(verdict: string, delta_pct: number): string {
  if (verdict === "above_market") return `${Math.abs(delta_pct).toFixed(0)}% above market — protect your margin`;
  if (verdict === "below_market") return `${Math.abs(delta_pct).toFixed(0)}% below market — competitive rate`;
  return "Competitive rate for this corridor";
}

export async function POST(request: Request) {
  let body: BenchmarkRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { origin, destination, rate_per_mile, equipment } = body;

  if (!origin || !destination || rate_per_mile == null || !equipment) {
    return Response.json(
      { error: "Missing required fields: origin, destination, rate_per_mile, equipment" },
      { status: 400 }
    );
  }

  if (typeof rate_per_mile !== "number" || rate_per_mile <= 0 || rate_per_mile > 20) {
    return Response.json({ error: "rate_per_mile must be a positive number" }, { status: 400 });
  }

  // ── Truckstop live data path ─────────────────────────────────────────────
  if (isTruckstopConfigured()) {
    try {
      const result = await getBookedRateEstimate(origin, destination, equipment);
      const { delta_pct, verdict } = computeVerdict(rate_per_mile, result.ratePerMile);

      return Response.json({
        market_avg_usd_per_mile: parseFloat(result.ratePerMile.toFixed(2)),
        ...(result.lowerBound ? { market_low_usd_per_mile: parseFloat(result.lowerBound.toFixed(2)) } : {}),
        ...(result.upperBound ? { market_high_usd_per_mile: parseFloat(result.upperBound.toFixed(2)) } : {}),
        delta_pct,
        verdict,
        verdict_label: verdictLabel(verdict, delta_pct),
        confidence: "truckstop_live",
        data_source: "Truckstop Rate Insights",
        disclaimer: "Live market data powered by Truckstop Rate Insights.",
      } satisfies BenchmarkResponse);
    } catch (err) {
      // Log and fall through to AI fallback
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[benchmark] Truckstop error (falling back to AI):", msg);
    }
  }

  // ── AI fallback path ─────────────────────────────────────────────────────
  try {
    const { text } = await generateText({
      model: "anthropic/claude-haiku-4.5",
      prompt: buildAIPrompt(origin, destination, rate_per_mile, equipment),
      maxOutputTokens: 256,
    });

    let parsed: Omit<BenchmarkResponse, "confidence" | "disclaimer" | "data_source">;
    try {
      let cleaned = text.trim();
      const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) cleaned = fenceMatch[1].trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[benchmark] Failed to parse AI response:", text);
      return Response.json({ error: "Failed to parse AI response" }, { status: 502 });
    }

    return Response.json({
      ...parsed,
      confidence: "ai_estimated",
      disclaimer: "AI-estimated from training data. Not a substitute for live market rates.",
    } satisfies BenchmarkResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[benchmark] AI error:", message);
    return Response.json({ error: "AI service unavailable" }, { status: 503 });
  }
}
