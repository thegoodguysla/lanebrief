import { generateText } from "ai";

type CarrierScoreRequest = {
  carrier_name: string;
  lane: string; // e.g. "Chicago, IL to Dallas, TX"
};

type CarrierScoreResponse = {
  score: number; // 0–100
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
  strengths: string[];
  risks: string[];
  confidence: "ai_estimated";
  disclaimer: string;
};

function scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function buildPrompt(carrierName: string, lane: string): string {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();

  return `You are a freight carrier reliability analyst. Estimate a reliability score for the carrier "${carrierName}" on the lane "${lane}" as of ${month} ${year}.

Consider: typical carrier on-time delivery performance on this lane type, carrier reputation, regional capacity availability, equipment reliability, safety culture, and seasonal patterns for this lane.

Respond with ONLY a JSON object (no markdown, no explanation) in this exact format:
{
  "score": <integer 0–100>,
  "summary": "<2–3 sentence narrative about this carrier's reliability on this lane>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "risks": ["<risk 1>", "<risk 2>"]
}

Rules:
- score: 0 (worst) to 100 (best). Use the full range — most carriers score 55–85.
- summary: specific to the lane and carrier type; mention seasonal or regional factors if relevant.
- strengths: exactly 2 short bullet phrases (5–10 words each)
- risks: exactly 2 short bullet phrases (5–10 words each)
- Be realistic and nuanced — avoid generic platitudes`;
}

export async function POST(request: Request) {
  let body: CarrierScoreRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { carrier_name, lane } = body;

  if (!carrier_name || !lane) {
    return Response.json(
      { error: "Missing required fields: carrier_name, lane" },
      { status: 400 }
    );
  }

  if (carrier_name.length > 100 || lane.length > 200) {
    return Response.json({ error: "Input too long" }, { status: 400 });
  }

  try {
    const { text } = await generateText({
      model: "anthropic/claude-haiku-4.5",
      prompt: buildPrompt(carrier_name, lane),
      maxOutputTokens: 512,
    });

    let parsed: Pick<CarrierScoreResponse, "score" | "summary" | "strengths" | "risks">;
    try {
      let cleaned = text.trim();
      const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) cleaned = fenceMatch[1].trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[carrier-score] Failed to parse AI response:", text);
      return Response.json({ error: "Failed to parse AI response" }, { status: 502 });
    }

    const score = Math.max(0, Math.min(100, Math.round(parsed.score)));

    return Response.json({
      score,
      grade: scoreToGrade(score),
      summary: parsed.summary,
      strengths: parsed.strengths,
      risks: parsed.risks,
      confidence: "ai_estimated",
      disclaimer:
        "AI-estimated from training data. Not a substitute for FMCSA SAFER data or direct carrier vetting.",
    } satisfies CarrierScoreResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[carrier-score] AI error:", message);
    return Response.json({ error: "AI service unavailable" }, { status: 503 });
  }
}
