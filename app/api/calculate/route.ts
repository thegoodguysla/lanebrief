import { generateText } from "ai";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// US-MX tariff risk detection (reused from dashboard logic)
const MX_KEYWORDS = [
  "nuevo laredo", "laredo", "ciudad juarez", "juarez", "el paso",
  "reynosa", "pharr", "mcallen", "piedras negras", "eagle pass",
  "nogales", "otay mesa", "tijuana", "mexico", "monterrey",
  "guadalajara", "cdmx", "mexico city",
];
const CA_KEYWORDS = [
  "canada", "ontario", "quebec", "british columbia", "alberta",
  "detroit", "windsor", "toronto", "montreal", "vancouver", "calgary",
  "edmonton", "buffalo", "fort erie", "blaine",
];

export type CalculateRequest = {
  origin: string;
  destination: string;
  equipment: "dry_van" | "reefer" | "flatbed";
  distance_miles: number;
  target_margin_pct: number; // 0–50
};

export type ForecastDirection = "up" | "down" | "flat";
export type CarrierRiskTier = "low" | "medium" | "high";

export type CalculateResponse = {
  // Inputs echo
  origin: string;
  destination: string;
  equipment: string;
  distance_miles: number;
  target_margin_pct: number;

  // Rate data
  spot_rate_per_mile: number;
  carrier_buy_rate_per_mile: number;
  gross_profit_per_mile: number;
  gross_profit_per_load: number;

  // Contextual signals
  forecast_direction: ForecastDirection;
  forecast_confidence: "high" | "medium" | "low";
  carrier_risk_tier: CarrierRiskTier;
  carrier_risk_score: number;
  carrier_risk_signals: string[];
  tariff_risk: "MX" | "CA" | null;

  // Recommendation
  recommendation: string;
  recommendation_action: "lock_in" | "wait" | "verify_carrier" | "caution";

  confidence: "ai_estimated";
  disclaimer: string;
};

function detectTariffRisk(origin: string, destination: string): "MX" | "CA" | null {
  const text = `${origin} ${destination}`.toLowerCase();
  if (MX_KEYWORDS.some((kw) => text.includes(kw))) return "MX";
  if (CA_KEYWORDS.some((kw) => text.includes(kw))) return "CA";
  return null;
}

function buildCalculatePrompt(
  origin: string,
  destination: string,
  equipment: string,
  distanceMiles: number,
  targetMarginPct: number,
): string {
  const now = new Date();
  const month = MONTH_NAMES[now.getMonth()];
  const year = now.getFullYear();
  const equipLabel =
    equipment === "dry_van" ? "Dry Van" : equipment === "reefer" ? "Refrigerated (Reefer)" : "Flatbed";

  return `You are a senior freight broker analyst. Analyze this lane and generate a profit calculation estimate.

Lane: ${origin} → ${destination}
Equipment: ${equipLabel}
Distance: ${distanceMiles} miles
Broker's target margin: ${targetMarginPct}%
Current month: ${month} ${year}

Provide:
1. Current spot market rate ($/mile) for this lane and equipment type
2. 7-day rate direction forecast (up/down/flat) with confidence (high/medium/low)
3. Carrier payment risk profile for typical carriers on this lane (score 0-100, tier low/medium/high, 3 signals)
4. One concise recommendation (15-20 words max)

Respond with ONLY a JSON object (no markdown):
{
  "spot_rate_per_mile": <number, realistic 2-decimal spot rate>,
  "forecast_direction": <"up" | "down" | "flat">,
  "forecast_confidence": <"high" | "medium" | "low">,
  "carrier_risk_score": <integer 0-100>,
  "carrier_risk_tier": <"low" | "medium" | "high">,
  "carrier_risk_signals": ["<signal 1>", "<signal 2>", "<signal 3>"],
  "recommendation": "<15-20 word actionable recommendation>",
  "recommendation_action": <"lock_in" | "wait" | "verify_carrier" | "caution">
}

Rules for spot_rate_per_mile:
- Use realistic ${month} ${year} seasonal patterns and lane supply/demand
- Dry van typical range: $1.80–$3.20/mile; Reefer: $2.20–$4.00/mile; Flatbed: $2.00–$3.50/mile
- Adjust for lane specifics (backhaul vs headhaul, regional capacity, distance premium for short hauls)

Rules for forecast:
- "up" = rates expected to rise >3% over 7 days
- "down" = rates expected to fall >3% over 7 days
- "flat" = rates stable within ±3%
- Base on seasonal patterns, capacity cycles, and known lane dynamics for ${month}

Rules for carrier risk (lane-level average, not specific carrier):
- Most established lanes: score 15-35 (low)
- High-volume lanes with many new entrants: score 35-55 (medium)
- Specialized/border lanes with fraud exposure: score 55-80 (high)
- carrier_risk_tier: low if score<40, medium if 40-69, high if 70+

Rules for recommendation_action:
- lock_in: rates rising + low carrier risk = secure carrier now
- wait: rates falling = hold off, better rates coming
- verify_carrier: high carrier risk = vet carrier carefully before tendering
- caution: tariff/border risk or mixed signals = proceed carefully`;
}

export async function POST(request: Request) {
  let body: CalculateRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { origin, destination, equipment, distance_miles, target_margin_pct } = body;

  if (!origin || !destination || !equipment || distance_miles == null || target_margin_pct == null) {
    return Response.json(
      { error: "Missing required fields: origin, destination, equipment, distance_miles, target_margin_pct" },
      { status: 400 },
    );
  }

  if (!["dry_van", "reefer", "flatbed"].includes(equipment)) {
    return Response.json({ error: "equipment must be dry_van, reefer, or flatbed" }, { status: 400 });
  }

  if (typeof distance_miles !== "number" || distance_miles <= 0 || distance_miles > 5000) {
    return Response.json({ error: "distance_miles must be between 1 and 5000" }, { status: 400 });
  }

  if (typeof target_margin_pct !== "number" || target_margin_pct < 0 || target_margin_pct > 50) {
    return Response.json({ error: "target_margin_pct must be between 0 and 50" }, { status: 400 });
  }

  try {
    const { text } = await generateText({
      model: "anthropic/claude-haiku-4.5",
      prompt: buildCalculatePrompt(origin, destination, equipment, distance_miles, target_margin_pct),
      maxOutputTokens: 512,
    });

    let parsed: {
      spot_rate_per_mile: number;
      forecast_direction: ForecastDirection;
      forecast_confidence: "high" | "medium" | "low";
      carrier_risk_score: number;
      carrier_risk_tier: CarrierRiskTier;
      carrier_risk_signals: string[];
      recommendation: string;
      recommendation_action: "lock_in" | "wait" | "verify_carrier" | "caution";
    };

    try {
      let cleaned = text.trim();
      const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) cleaned = fenceMatch[1].trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[calculate] Failed to parse AI response:", text);
      return Response.json({ error: "Failed to parse AI response" }, { status: 502 });
    }

    const spotRate = Math.round(parsed.spot_rate_per_mile * 100) / 100;
    const marginDecimal = target_margin_pct / 100;
    const buyRate = Math.round(spotRate * (1 - marginDecimal) * 100) / 100;
    const grossPerMile = Math.round((spotRate - buyRate) * 100) / 100;
    const grossPerLoad = Math.round(grossPerMile * distance_miles);

    const tariffRisk = detectTariffRisk(origin, destination);

    return Response.json({
      origin,
      destination,
      equipment,
      distance_miles,
      target_margin_pct,

      spot_rate_per_mile: spotRate,
      carrier_buy_rate_per_mile: buyRate,
      gross_profit_per_mile: grossPerMile,
      gross_profit_per_load: grossPerLoad,

      forecast_direction: parsed.forecast_direction,
      forecast_confidence: parsed.forecast_confidence,
      carrier_risk_tier: parsed.carrier_risk_tier,
      carrier_risk_score: Math.max(0, Math.min(100, Math.round(parsed.carrier_risk_score))),
      carrier_risk_signals: (parsed.carrier_risk_signals ?? []).slice(0, 3),
      tariff_risk: tariffRisk,

      recommendation: parsed.recommendation,
      recommendation_action: parsed.recommendation_action,

      confidence: "ai_estimated",
      disclaimer:
        "AI-estimated from training data and lane patterns. Not a substitute for live market rates. Verify with DAT, Loadsmith, or your TMS before quoting.",
    } satisfies CalculateResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[calculate] AI error:", message);
    return Response.json({ error: "AI service unavailable" }, { status: 503 });
  }
}
