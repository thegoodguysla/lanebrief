import { generateText } from "ai";

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
  delta_pct: number;
  verdict: "above_market" | "at_market" | "below_market";
  verdict_label: string;
  confidence: "ai_estimated";
  disclaimer: string;
};

function buildPrompt(origin: string, destination: string, ratePpm: number, equipment: string): string {
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

  const prompt = buildPrompt(origin, destination, rate_per_mile, equipment);

  try {
    const { text } = await generateText({
      model: "anthropic/claude-haiku-4.5",
      prompt,
    });

    let parsed: Omit<BenchmarkResponse, "confidence" | "disclaimer">;
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      console.error("[benchmark] Failed to parse AI response:", text);
      return Response.json({ error: "Failed to parse AI response" }, { status: 502 });
    }

    const response: BenchmarkResponse = {
      ...parsed,
      confidence: "ai_estimated",
      disclaimer: "AI-estimated from training data. Not a substitute for live market rates.",
    };

    return Response.json(response);
  } catch (err) {
    console.error("[benchmark] AI error:", err);
    return Response.json({ error: "AI service unavailable" }, { status: 503 });
  }
}
