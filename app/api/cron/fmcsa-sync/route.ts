import { syncFmcsaData } from "@/lib/autonomous/fmcsa-sync";

// Vercel Cron: daily at 6am UTC
// vercel.json schedule: "0 6 * * *"

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncFmcsaData();

    if (result.stale) {
      console.warn("[fmcsa-sync] WARNING: carrier data is stale (>72h old)");
    }

    console.log(`[fmcsa-sync] Completed. upserted=${result.upserted} source=${result.source} stale=${result.stale}`);

    return Response.json({
      ok: true,
      upserted: result.upserted,
      source: result.source,
      stale: result.stale,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[fmcsa-sync] Error:", err);
    return Response.json({ error: "Sync failed" }, { status: 500 });
  }
}
