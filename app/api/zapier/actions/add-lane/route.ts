import { validateApiKey, isValidatedKey } from "@/lib/api-key";
import { getDb } from "@/lib/db";
import { lanes } from "@/lib/db/schema";
import { randomUUID } from "crypto";

// POST /api/zapier/actions/add-lane
// Zapier action: add a lane to the user's portfolio
export async function POST(request: Request) {
  const validated = await validateApiKey(request);
  if (!isValidatedKey(validated)) {
    return Response.json({ error: validated.error }, { status: validated.status });
  }

  let body: { origin?: string; destination?: string; equipment?: string; alert_threshold_pct?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { origin, destination, equipment = "dry_van", alert_threshold_pct = 5 } = body;

  if (!origin || typeof origin !== "string" || origin.trim().length === 0) {
    return Response.json({ error: "origin is required" }, { status: 400 });
  }
  if (!destination || typeof destination !== "string" || destination.trim().length === 0) {
    return Response.json({ error: "destination is required" }, { status: 400 });
  }

  const db = getDb();
  const id = randomUUID();
  try {
    await db.insert(lanes).values({
      id,
      userId: validated.userId,
      origin: origin.trim(),
      destination: destination.trim(),
      equipment,
      alertThresholdPct: Math.min(Math.max(Number(alert_threshold_pct) || 5, 1), 50),
    });
  } catch (err: unknown) {
    // Unique constraint violation — lane already exists
    if (err instanceof Error && err.message.includes("unique")) {
      return Response.json({ error: "Lane already exists in portfolio", alreadyExists: true }, { status: 409 });
    }
    throw err;
  }

  return Response.json({
    id,
    origin: origin.trim(),
    destination: destination.trim(),
    equipment,
    alert_threshold_pct: Math.min(Math.max(Number(alert_threshold_pct) || 5, 1), 50),
    added: true,
  });
}
