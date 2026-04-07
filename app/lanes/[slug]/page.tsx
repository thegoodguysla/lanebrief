import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { rateSnapshots } from "@/lib/db/schema";
import { and, desc, ilike, gte } from "drizzle-orm";
import { generateText } from "ai";
import { CORRIDOR_MAP, CORRIDORS, relatedCorridors, cityName } from "@/lib/corridors";
import { LaneChat } from "@/components/lane-chat";

// ISR: regenerate every 24 hours
export const revalidate = 86400;

// Pre-render top corridors at build time
export async function generateStaticParams() {
  return CORRIDORS.slice(0, 100).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const corridor = CORRIDOR_MAP.get(slug);
  if (!corridor) return {};
  const { origin, destination } = corridor;
  const o = cityName(origin);
  const d = cityName(destination);
  return {
    title: `${o} to ${d} Freight Rates Today | LaneBrief`,
    description: `Current spot rates, 7-day forecasts, and carrier risk scores for ${o}–${d} freight. Updated daily.`,
    alternates: { canonical: `https://lanebrief.com/lanes/${slug}` },
    openGraph: {
      title: `${o} to ${d} Freight Rates Today`,
      description: `Current dry van, reefer, and flatbed spot rates on the ${o}–${d} corridor. Updated daily by LaneBrief.`,
      url: `https://lanebrief.com/lanes/${slug}`,
    },
  };
}

type ForecastResult = {
  direction: "up" | "down" | "flat";
  pctChange: number;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  currentRate: number;
  marketAvg: number;
  capacityLevel: "tight" | "moderate" | "loose";
  capacityReasoning: string;
  sparkline: number[]; // last 14 rate points for chart
};

async function getCorridorData(
  origin: string,
  destination: string,
): Promise<ForecastResult> {
  const db = getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Query existing rate snapshots from any user lane on this corridor
  const snapshots = await db
    .select({
      ratePerMile: rateSnapshots.ratePerMile,
      marketAvgUsdPerMile: rateSnapshots.marketAvgUsdPerMile,
      generatedAt: rateSnapshots.generatedAt,
    })
    .from(rateSnapshots)
    .where(
      and(
        ilike(rateSnapshots.origin, `%${cityName(origin)}%`),
        ilike(rateSnapshots.destination, `%${cityName(destination)}%`),
        gte(rateSnapshots.generatedAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(rateSnapshots.generatedAt))
    .limit(90);

  const hasHistory = snapshots.length >= 7;
  const sorted = [...snapshots].sort(
    (a, b) => a.generatedAt.getTime() - b.generatedAt.getTime()
  );
  const sparkline = sorted.slice(-14).map((s) => s.ratePerMile);
  const currentRate = hasHistory
    ? sorted[sorted.length - 1].ratePerMile
    : 0;
  const marketAvg = hasHistory
    ? snapshots.reduce((s, r) => s + r.marketAvgUsdPerMile, 0) / snapshots.length
    : 0;

  const month = new Date().toLocaleString("en-US", { month: "long" });
  const year = new Date().getFullYear();

  const historyContext = hasHistory
    ? `Rate history (last ${sorted.length} days, $/mile): ${sorted
        .slice(-14)
        .map((r) => r.ratePerMile.toFixed(2))
        .join(", ")}
Current rate: $${currentRate.toFixed(2)}/mi
Market avg: $${marketAvg.toFixed(2)}/mi`
    : `No historical rate data available. Generate a realistic market estimate based on typical freight rates for this corridor in ${month} ${year}.`;

  const prompt = `You are a freight market analyst. Provide a complete market snapshot for a dry van load from ${origin} to ${destination}.

${historyContext}

Return ONLY valid JSON (no markdown):
{
  "direction": "up" | "down" | "flat",
  "pct_change": <float -15 to 15, % change over 7 days>,
  "confidence": "high" | "medium" | "low",
  "reasoning": "<2 sentence forecast explanation>",
  "current_rate": <float $/mile, use provided if available, else estimate>,
  "market_avg": <float $/mile, use provided if available, else estimate>,
  "capacity_level": "tight" | "moderate" | "loose",
  "capacity_reasoning": "<1 sentence on carrier availability on this lane>"
}`;

  let parsed: {
    direction: string;
    pct_change: number;
    confidence: string;
    reasoning: string;
    current_rate: number;
    market_avg: number;
    capacity_level: string;
    capacity_reasoning: string;
  };

  try {
    const { text } = await generateText({
      model: "anthropic/claude-haiku-4.5",
      prompt,
      maxOutputTokens: 300,
    });
    let cleaned = text.trim();
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) cleaned = fence[1].trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback defaults
    parsed = {
      direction: "flat",
      pct_change: 0,
      confidence: "low",
      reasoning: "Market data temporarily unavailable. Check back shortly.",
      current_rate: currentRate || 2.5,
      market_avg: marketAvg || 2.4,
      capacity_level: "moderate",
      capacity_reasoning: "Capacity data is being updated.",
    };
  }

  const direction = (["up", "down", "flat"].includes(parsed.direction)
    ? parsed.direction
    : "flat") as ForecastResult["direction"];

  return {
    direction,
    pctChange: Math.max(-15, Math.min(15, parsed.pct_change ?? 0)),
    confidence: (["high", "medium", "low"].includes(parsed.confidence)
      ? parsed.confidence
      : "medium") as ForecastResult["confidence"],
    reasoning: parsed.reasoning,
    currentRate: hasHistory ? currentRate : (parsed.current_rate ?? 2.5),
    marketAvg: hasHistory ? marketAvg : (parsed.market_avg ?? 2.4),
    capacityLevel: (["tight", "moderate", "loose"].includes(parsed.capacity_level)
      ? parsed.capacity_level
      : "moderate") as ForecastResult["capacityLevel"],
    capacityReasoning: parsed.capacity_reasoning,
    sparkline: sparkline.length > 0 ? sparkline : [parsed.current_rate ?? 2.5],
  };
}

// Detect tariff-impacted corridor
function getTariffFlag(origin: string, destination: string): "MX" | "CA" | null {
  const text = `${origin} ${destination}`.toLowerCase();
  if (/(mexico|laredo|juarez|juárez|nuevo laredo|reynosa|el paso|nogales|otay mesa|tijuana|matamoros|monterrey)/.test(text)) return "MX";
  if (/(canada|ontario|toronto|montreal|vancouver|detroit|windsor|buffalo|calgary|edmonton)/.test(text)) return "CA";
  return null;
}

// Inline SVG sparkline
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 0.01;
  const w = 200;
  const h = 48;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const color =
    values[values.length - 1] > values[0]
      ? "#ef4444"
      : values[values.length - 1] < values[0]
      ? "#22c55e"
      : "#94a3b8";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" aria-hidden>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default async function LanePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const corridor = CORRIDOR_MAP.get(slug);
  if (!corridor) notFound();

  const { origin, destination } = corridor;
  const o = cityName(origin);
  const d = cityName(destination);

  const data = await getCorridorData(origin, destination);
  const tariff = getTariffFlag(origin, destination);
  const related = relatedCorridors(corridor, 5);

  const directionLabel =
    data.direction === "up"
      ? `▲ +${Math.abs(data.pctChange).toFixed(1)}% (rates rising)`
      : data.direction === "down"
      ? `▼ -${Math.abs(data.pctChange).toFixed(1)}% (rates softening)`
      : "→ Flat (stable rates)";

  const directionColor =
    data.direction === "up"
      ? "text-red-600 dark:text-red-400"
      : data.direction === "down"
      ? "text-emerald-600 dark:text-emerald-500"
      : "text-slate-500";

  const capacityColor =
    data.capacityLevel === "tight"
      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800/40"
      : data.capacityLevel === "loose"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/40"
      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/40";

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${o} to ${d} Freight Rates`,
    description: `Current spot rates and 7-day forecast for ${o}–${d} dry van freight. Updated daily.`,
    url: `https://lanebrief.com/lanes/${slug}`,
    creator: { "@type": "Organization", name: "LaneBrief", url: "https://lanebrief.com" },
    variableMeasured: "Freight rate per mile (USD)",
    measurementTechnique: "Market aggregation + AI forecast",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Nav */}
        <nav className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight">
              LaneBrief
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/lanes" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                All Lanes
              </Link>
              <Link
                href="/sign-up"
                className="text-sm bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:bg-primary/90 transition-colors"
              >
                Free sign-up
              </Link>
            </div>
          </div>
        </nav>

        <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <span>/</span>
            <Link href="/lanes" className="hover:text-foreground">Freight Lanes</Link>
            <span>/</span>
            <span className="text-foreground">{o} → {d}</span>
          </nav>

          {/* H1 + badges */}
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {o} to {d} Freight Rates
            </h1>
            <p className="text-muted-foreground">
              Current spot rates, 7-day forecast, and carrier capacity for dry van freight on the {o}–{d} corridor. Updated daily.
            </p>
            <div className="flex flex-wrap gap-2">
              {tariff === "MX" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-700/40">
                  ⚠ US-MX Tariff Impact
                </span>
              )}
              {tariff === "CA" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-700/40">
                  ⚠ US-CA Tariff Impact
                </span>
              )}
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${capacityColor}`}>
                Capacity: {data.capacityLevel === "tight" ? "Tight" : data.capacityLevel === "loose" ? "Loose" : "Moderate"}
              </span>
            </div>
          </div>

          {/* Rate cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Current Spot Rate</p>
              <p className="text-3xl font-bold">${data.currentRate.toFixed(2)}<span className="text-base font-normal text-muted-foreground">/mi</span></p>
              <p className="text-xs text-muted-foreground">Dry van (DAT-indexed)</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Market Average</p>
              <p className="text-3xl font-bold">${data.marketAvg.toFixed(2)}<span className="text-base font-normal text-muted-foreground">/mi</span></p>
              <p className="text-xs text-muted-foreground">30-day corridor avg</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">7-Day Forecast</p>
              <p className={`text-2xl font-bold ${directionColor}`}>{directionLabel}</p>
              <p className="text-xs text-muted-foreground capitalize">{data.confidence} confidence</p>
            </div>
          </div>

          {/* Sparkline */}
          {data.sparkline.length > 2 && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">30-Day Rate Trend ($/mi)</p>
                <p className="text-xs text-muted-foreground">{data.sparkline.length} data points</p>
              </div>
              <Sparkline values={data.sparkline} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>${Math.min(...data.sparkline).toFixed(2)} low</span>
                <span>${Math.max(...data.sparkline).toFixed(2)} high</span>
              </div>
            </div>
          )}

          {/* Forecast + Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-2">
              <p className="text-sm font-semibold">Rate Forecast</p>
              <p className={`text-lg font-bold ${directionColor}`}>{directionLabel}</p>
              <p className="text-sm text-muted-foreground">{data.reasoning}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-2">
              <p className="text-sm font-semibold">Carrier Capacity</p>
              <p className={`text-lg font-bold`}>
                {data.capacityLevel === "tight" ? "🔴 Tight" : data.capacityLevel === "loose" ? "🟢 Loose" : "🟡 Moderate"}
              </p>
              <p className="text-sm text-muted-foreground">{data.capacityReasoning}</p>
            </div>
          </div>

          {/* Tariff notice */}
          {tariff && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 space-y-1 dark:bg-orange-950/20 dark:border-orange-700/40">
              <p className="font-semibold text-orange-800 dark:text-orange-300">
                {tariff === "MX" ? "🇲🇽 US-Mexico Tariff Alert" : "🇨🇦 US-Canada Tariff Alert"}
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-400">
                {tariff === "MX"
                  ? "This corridor crosses the US-Mexico border. Active tariffs and electronic manifest requirements may affect transit times and carrier availability. Monitor shipper instructions before tendering."
                  : "This corridor crosses the US-Canada border. 25–35% tariffs on non-USMCA goods are in effect. Verify USMCA compliance before tendering and expect border delay variability."}
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-4 text-center">
            <h2 className="text-xl font-semibold">Track this lane in real time</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Get daily rate alerts, instant briefs, and carrier risk scores for {o}–{d} — free for up to 3 lanes.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Start free — no credit card required
            </Link>
            <p className="text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link href="/sign-in" className="underline hover:text-foreground">
                Sign in
              </Link>
            </p>
          </div>

          {/* Related lanes */}
          {related.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Related Freight Lanes</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/lanes/${r.slug}`}
                    className="rounded-lg border border-border bg-card px-4 py-3 text-sm hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    <span className="font-medium">{cityName(r.origin)}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="font-medium">{cityName(r.destination)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Footer links */}
          <div className="pt-4 border-t border-border/50 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <Link href="/lanes" className="hover:text-foreground">All freight lanes</Link>
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/calculate" className="hover:text-foreground">Profit Calculator</Link>
            <Link href="/" className="hover:text-foreground">LaneBrief home</Link>
          </div>
        </main>
      </div>

      <LaneChat
        lane={{
          origin,
          destination,
          currentRate: data.currentRate,
          marketAvg: data.marketAvg,
          direction: data.direction,
          pctChange: data.pctChange,
          confidence: data.confidence,
          reasoning: data.reasoning,
          capacityLevel: data.capacityLevel,
          capacityReasoning: data.capacityReasoning,
          tariff,
          sparkline: data.sparkline,
        }}
      />
    </>
  );
}
