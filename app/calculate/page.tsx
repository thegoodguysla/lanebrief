"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { CalculateResponse } from "@/app/api/calculate/route";

type Equipment = "dry_van" | "reefer" | "flatbed";

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  dry_van: "Dry Van",
  reefer: "Reefer",
  flatbed: "Flatbed",
};

function ForecastArrow({ direction }: { direction: "up" | "down" | "flat" }) {
  if (direction === "up") return <span className="text-red-400 font-bold">↑ Rising</span>;
  if (direction === "down") return <span className="text-emerald-400 font-bold">↓ Softening</span>;
  return <span className="text-yellow-400 font-bold">→ Stable</span>;
}

function RiskBadge({ tier }: { tier: "low" | "medium" | "high" }) {
  if (tier === "low") return <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-700">Low Risk</Badge>;
  if (tier === "medium") return <Badge className="bg-yellow-900/50 text-yellow-300 border-yellow-700">Medium Risk</Badge>;
  return <Badge className="bg-red-900/50 text-red-300 border-red-700">High Risk</Badge>;
}

function ActionBadge({ action }: { action: CalculateResponse["recommendation_action"] }) {
  const config = {
    lock_in: { label: "Lock in carrier now", cls: "bg-emerald-900/60 text-emerald-200 border-emerald-600" },
    wait: { label: "Rates softening — wait", cls: "bg-yellow-900/60 text-yellow-200 border-yellow-600" },
    verify_carrier: { label: "High risk — verify carrier carefully", cls: "bg-red-900/60 text-red-200 border-red-600" },
    caution: { label: "Proceed with caution", cls: "bg-orange-900/60 text-orange-200 border-orange-600" },
  };
  const { label, cls } = config[action];
  return <Badge className={`text-sm py-1 px-3 ${cls}`}>{label}</Badge>;
}

function CalculatePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [origin, setOrigin] = useState(searchParams.get("origin") ?? "");
  const [destination, setDestination] = useState(searchParams.get("destination") ?? "");
  const [equipment, setEquipment] = useState<Equipment>(
    (searchParams.get("type") as Equipment) ?? "dry_van",
  );
  const [distance, setDistance] = useState(searchParams.get("miles") ?? "");
  const [margin, setMargin] = useState(searchParams.get("margin") ?? "15");

  const [result, setResult] = useState<CalculateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const calculate = useCallback(async () => {
    const originTrimmed = origin.trim();
    const destTrimmed = destination.trim();
    const distNum = parseFloat(distance);
    const marginNum = parseFloat(margin);

    if (!originTrimmed || !destTrimmed) {
      setError("Origin and destination are required.");
      return;
    }
    if (isNaN(distNum) || distNum <= 0 || distNum > 5000) {
      setError("Distance must be between 1 and 5000 miles.");
      return;
    }
    if (isNaN(marginNum) || marginNum < 0 || marginNum > 50) {
      setError("Target margin must be between 0% and 50%.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: originTrimmed,
          destination: destTrimmed,
          equipment,
          distance_miles: distNum,
          target_margin_pct: marginNum,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Calculation failed");
      }

      const data: CalculateResponse = await res.json();
      setResult(data);

      // Update URL for shareability
      const params = new URLSearchParams({
        origin: originTrimmed,
        destination: destTrimmed,
        type: equipment,
        miles: String(distNum),
        margin: String(marginNum),
      });
      router.replace(`/calculate?${params.toString()}`, { scroll: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [origin, destination, equipment, distance, margin, router]);

  // Auto-calculate if all params are pre-filled from URL
  useEffect(() => {
    if (
      searchParams.get("origin") &&
      searchParams.get("destination") &&
      searchParams.get("miles")
    ) {
      calculate();
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shareUrl =
    typeof window !== "undefined" && result
      ? `${window.location.origin}/calculate?origin=${encodeURIComponent(result.origin)}&destination=${encodeURIComponent(result.destination)}&type=${result.equipment}&miles=${result.distance_miles}&margin=${result.target_margin_pct}`
      : "";

  function handleCopy() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-white/10 px-4 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <span className="text-[#00C2A8] font-bold text-lg">▶</span>
          <span className="font-semibold">LaneBrief</span>
          <span className="text-white/30 mx-1">/</span>
          <span>Profit Calculator</span>
        </Link>
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            ← Dashboard
          </Button>
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Broker Profit Calculator</h1>
          <p className="text-muted-foreground text-sm">
            Enter a lane to get instant buy rate, sell rate, and estimated margin — with rate forecast and carrier risk.
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-card border border-white/10 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Origin</label>
              <Input
                placeholder="e.g. Chicago, IL"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="bg-background/50 border-white/15"
                onKeyDown={(e) => e.key === "Enter" && calculate()}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Destination</label>
              <Input
                placeholder="e.g. Dallas, TX"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="bg-background/50 border-white/15"
                onKeyDown={(e) => e.key === "Enter" && calculate()}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {/* Equipment selector */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Load Type</label>
              <div className="flex gap-1">
                {(["dry_van", "reefer", "flatbed"] as Equipment[]).map((eq) => (
                  <button
                    key={eq}
                    onClick={() => setEquipment(eq)}
                    className={`flex-1 text-xs py-2 px-1 rounded-md border transition-colors ${
                      equipment === eq
                        ? "bg-[#00C2A8]/20 border-[#00C2A8] text-[#00C2A8]"
                        : "bg-background/30 border-white/15 text-muted-foreground hover:border-white/30"
                    }`}
                  >
                    {eq === "dry_van" ? "Dry Van" : eq === "reefer" ? "Reefer" : "Flatbed"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Distance (miles)</label>
              <Input
                type="number"
                placeholder="e.g. 920"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className="bg-background/50 border-white/15"
                min={1}
                max={5000}
                onKeyDown={(e) => e.key === "Enter" && calculate()}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Target Margin %</label>
              <Input
                type="number"
                placeholder="15"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                className="bg-background/50 border-white/15"
                min={0}
                max={50}
                onKeyDown={(e) => e.key === "Enter" && calculate()}
              />
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm mb-4">{error}</p>
          )}

          <Button
            onClick={calculate}
            disabled={loading}
            className="w-full bg-[#00C2A8] hover:bg-[#00b09a] text-white font-semibold py-3 text-base"
          >
            {loading ? "Calculating…" : "Calculate my profit →"}
          </Button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Tariff Warning */}
            {result.tariff_risk && (
              <div className="bg-orange-900/20 border border-orange-700/50 rounded-xl px-5 py-3 flex items-center gap-3">
                <span className="text-orange-400 text-lg">⚠</span>
                <p className="text-orange-200 text-sm">
                  <strong>Tariff Risk:</strong>{" "}
                  {result.tariff_risk === "MX"
                    ? "US-MX lane — rates volatile +15-25% (April 2026). Verify carrier authority at border crossings."
                    : "US-CA lane — 35% tariff exposure possible on non-USMCA goods. Confirm commodity eligibility before quoting."}
                </p>
              </div>
            )}

            {/* Main numbers */}
            <div className="bg-card border border-white/10 rounded-xl p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-muted-foreground text-sm mb-0.5">
                    {result.origin} → {result.destination} · {EQUIPMENT_LABELS[result.equipment as Equipment]} · {result.distance_miles} mi
                  </p>
                  <ActionBadge action={result.recommendation_action} />
                </div>
                <button
                  onClick={handleCopy}
                  className="text-xs text-muted-foreground hover:text-foreground border border-white/15 hover:border-white/30 rounded-md px-3 py-1.5 transition-colors"
                >
                  {copied ? "✓ Copied" : "Share link"}
                </button>
              </div>

              {/* Big numbers */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-background/40 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Spot Rate / mi</p>
                  <p className="text-2xl font-bold text-white">${result.spot_rate_per_mile.toFixed(2)}</p>
                </div>
                <div className="bg-background/40 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Carrier Buy Rate / mi</p>
                  <p className="text-2xl font-bold text-[#00C2A8]">${result.carrier_buy_rate_per_mile.toFixed(2)}</p>
                </div>
                <div className="bg-[#00C2A8]/10 border border-[#00C2A8]/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Gross Profit / Load</p>
                  <p className="text-2xl font-bold text-[#00C2A8]">${result.gross_profit_per_load.toLocaleString()}</p>
                </div>
                <div className="bg-background/40 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Profit / mi</p>
                  <p className="text-2xl font-bold text-white">${result.gross_profit_per_mile.toFixed(2)}</p>
                </div>
              </div>

              {/* Signals row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Forecast */}
                <div className="bg-background/30 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">7-Day Rate Forecast</p>
                  <p className="text-base font-semibold mb-1">
                    <ForecastArrow direction={result.forecast_direction} />
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{result.forecast_confidence} confidence</p>
                </div>

                {/* Carrier Risk */}
                <div className="bg-background/30 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Carrier Risk (lane avg)</p>
                  <div className="mb-1">
                    <RiskBadge tier={result.carrier_risk_tier} />
                  </div>
                  <p className="text-xs text-muted-foreground">Score: {result.carrier_risk_score}/100</p>
                </div>

                {/* Margin at a glance */}
                <div className="bg-background/30 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Your Target Margin</p>
                  <p className="text-2xl font-bold text-white">{result.target_margin_pct}%</p>
                  <p className="text-xs text-muted-foreground">${result.gross_profit_per_mile.toFixed(2)}/mi kept</p>
                </div>
              </div>
            </div>

            {/* Carrier risk signals */}
            {result.carrier_risk_signals.length > 0 && (
              <div className="bg-card border border-white/10 rounded-xl p-5">
                <p className="text-sm font-semibold text-white mb-3">Carrier Risk Signals</p>
                <ul className="space-y-1.5">
                  {result.carrier_risk_signals.map((signal, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-yellow-500 mt-0.5">•</span>
                      {signal}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendation */}
            <div className="bg-card border border-white/10 rounded-xl p-5">
              <p className="text-sm font-semibold text-white mb-1">Recommendation</p>
              <p className="text-muted-foreground text-sm">{result.recommendation}</p>
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-muted-foreground/60 text-center px-4">
              {result.disclaimer}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CalculatePage() {
  return (
    <Suspense>
      <CalculatePageInner />
    </Suspense>
  );
}
