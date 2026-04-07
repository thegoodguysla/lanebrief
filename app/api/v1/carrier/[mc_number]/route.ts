import { validateApiKey, isValidatedKey } from "@/lib/api-key";
import { getDb } from "@/lib/db";
import { carriers, carrierRiskCache } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ mc_number: string }> }) {
  const validated = await validateApiKey(request);
  if (!isValidatedKey(validated)) {
    return Response.json({ error: validated.error }, { status: validated.status });
  }

  const { mc_number } = await params;

  const db = getDb();
  const carrier = await db
    .select()
    .from(carriers)
    .where(eq(carriers.dotNumber, mc_number))
    .limit(1);

  if (carrier.length === 0) {
    return Response.json({ error: "Carrier not found" }, { status: 404 });
  }

  const riskData = await db
    .select()
    .from(carrierRiskCache)
    .where(eq(carrierRiskCache.carrierId, carrier[0].id))
    .orderBy(desc(carrierRiskCache.generatedAt))
    .limit(1);

  if (riskData.length === 0) {
    return Response.json({
      mc_number,
      carrier_name: carrier[0].name,
      risk_score: null,
      risk_level: null,
      flags: [],
      last_checked: null,
    });
  }

  const risk = riskData[0];
  let signals: string[] = [];
  try { signals = JSON.parse(risk.signals); } catch { /* ignore */ }

  return Response.json({
    mc_number,
    carrier_name: carrier[0].name,
    risk_score: risk.score,
    risk_level: risk.tier,
    flags: signals,
    last_checked: risk.generatedAt,
  });
}
