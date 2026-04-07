"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser, UserButton } from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Lane = {
  id: string;
  origin: string;
  destination: string;
  equipment: string;
  alertThresholdPct: number;
};

type ForecastData = {
  forecastDirection: "up" | "down" | "flat" | null;
  forecastConfidence: "high" | "medium" | "low" | null;
  currentRateEstimate: number | null;
  weekOverWeekDeltaPct: number | null;
};

type CapacityData = {
  capacityLevel: "tight" | "moderate" | "loose" | null;
};

type TenderData = {
  riskLevel: "high" | "medium" | "low" | null;
  estimatedAcceptancePct: number | null;
};

type SortKey = "lane" | "rate" | "trend" | "risk" | "forecast";
type SortDir = "asc" | "desc";

const MX_HIGH_RISK = ["nuevo laredo", "laredo", "el paso", "reynosa", "pharr", "mcallen", "nogales", "tijuana", "eagle pass", "del rio"];
const CA_HIGH_RISK = ["detroit", "windsor", "port huron", "sarnia"];
const MX_GENERAL = ["mexico", "monterrey", "guadalajara", "matamoros"];
const CA_GENERAL = ["canada", "toronto", "montreal", "vancouver", "calgary", "edmonton", "ontario", "quebec"];

function getTariffFlag(origin: string, destination: string): string | null {
  const text = `${origin} ${destination}`.toLowerCase();
  if (MX_HIGH_RISK.some((kw) => text.includes(kw))) return "MX-high";
  if (CA_HIGH_RISK.some((kw) => text.includes(kw))) return "CA-high";
  if (MX_GENERAL.some((kw) => text.includes(kw))) return "MX";
  if (CA_GENERAL.some((kw) => text.includes(kw))) return "CA";
  return null;
}

function trendArrow(deltaPct: number | null) {
  if (deltaPct === null) return { icon: "—", color: "text-muted-foreground", label: "No data" };
  if (deltaPct > 0) return { icon: `↑ +${deltaPct.toFixed(1)}%`, color: "text-red-600", label: "Rate up" };
  if (deltaPct < 0) return { icon: `↓ ${deltaPct.toFixed(1)}%`, color: "text-green-600", label: "Rate down" };
  return { icon: "→ 0%", color: "text-muted-foreground", label: "Flat" };
}

function forecastLabel(direction: string | null) {
  if (direction === "up") return { icon: "↑ Up", color: "text-red-600" };
  if (direction === "down") return { icon: "↓ Down", color: "text-green-600" };
  if (direction === "flat") return { icon: "→ Flat", color: "text-muted-foreground" };
  return { icon: "—", color: "text-muted-foreground" };
}

function riskBadge(risk: string | null, pct: number | null) {
  const label = pct !== null ? `${pct}%` : (risk ?? "—");
  if (risk === "high") return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-red-50 text-red-700">⚠ {label}</span>;
  if (risk === "medium") return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-orange-50 text-orange-700">◑ {label}</span>;
  if (risk === "low") return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-green-50 text-green-700">✓ {label}</span>;
  return <span className="text-xs text-muted-foreground">—</span>;
}

function capacityBadge(level: string | null) {
  if (level === "tight") return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-red-50 text-red-700">🔴 Tight</span>;
  if (level === "moderate") return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-yellow-50 text-yellow-700">🟡 Moderate</span>;
  if (level === "loose") return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-green-50 text-green-700">🟢 Loose</span>;
  return <span className="text-xs text-muted-foreground">—</span>;
}

export default function PortfolioPage() {
  const { isLoaded, user } = useUser();
  const router = useRouter();

  const [lanes, setLanes] = useState<Lane[]>([]);
  const [forecasts, setForecasts] = useState<Record<string, ForecastData>>({});
  const [capacity, setCapacity] = useState<Record<string, CapacityData>>({});
  const [tender, setTender] = useState<Record<string, TenderData>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("lane");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Add lane form
  const [addOrigin, setAddOrigin] = useState("");
  const [addDest, setAddDest] = useState("");
  const [addEquip, setAddEquip] = useState("dry_van");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const fetchSignals = useCallback((laneIds: string[]) => {
    laneIds.forEach((id) => {
      fetch(`/api/lanes/${id}/forecast`)
        .then((r) => r.json())
        .then((data) => setForecasts((prev) => ({ ...prev, [id]: data })))
        .catch(() => {});

      fetch(`/api/lanes/${id}/capacity-heatmap`)
        .then((r) => r.json())
        .then((data) => setCapacity((prev) => ({ ...prev, [id]: data })))
        .catch(() => {});
    });

    if (laneIds.length > 0) {
      fetch("/api/tender-acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneIds }),
      })
        .then((r) => r.json())
        .then((data: Record<string, TenderData>) => setTender((prev) => ({ ...prev, ...data })))
        .catch(() => {});
    }
  }, []);

  const loadLanes = useCallback(async () => {
    const res = await fetch("/api/lanes");
    if (!res.ok) return;
    const data = await res.json() as { lanes: Lane[] };
    setLanes(data.lanes ?? []);
    fetchSignals((data.lanes ?? []).map((l) => l.id));
  }, [fetchSignals]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { router.push("/sign-in"); return; }

    fetch("/api/user/sync", { method: "POST" })
      .then(() => loadLanes())
      .catch(() => loadLanes())
      .finally(() => setLoading(false));
  }, [isLoaded, user, router, loadLanes]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLanes();
    setRefreshing(false);
  };

  const handleRemoveLane = async (laneId: string) => {
    await fetch("/api/lanes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ laneId }),
    });
    setLanes((prev) => prev.filter((l) => l.id !== laneId));
  };

  const handleAddLane = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addOrigin || !addDest) return;
    setAdding(true);
    try {
      const res = await fetch("/api/lanes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: addOrigin, destination: addDest, equipment: addEquip }),
      });
      if (res.ok) {
        const data = await res.json() as { lane: Lane };
        setLanes((prev) => [...prev, data.lane]);
        fetchSignals([data.lane.id]);
        setAddOrigin("");
        setAddDest("");
        setShowAdd(false);
      }
    } finally {
      setAdding(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // Portfolio score: count lanes needing attention
  const attentionCount = lanes.filter((l) => {
    const f = forecasts[l.id];
    const t = tender[l.id];
    const tariff = getTariffFlag(l.origin, l.destination);
    const hasAlert = (f?.weekOverWeekDeltaPct !== null && Math.abs(f?.weekOverWeekDeltaPct ?? 0) > 3) || t?.riskLevel === "high" || tariff?.includes("high");
    return hasAlert;
  }).length;

  const sortedLanes = [...lanes].sort((a, b) => {
    const fa = forecasts[a.id];
    const fb = forecasts[b.id];
    const ta = tender[a.id];
    const tb = tender[b.id];
    let cmp = 0;

    if (sortKey === "lane") cmp = `${a.origin}${a.destination}`.localeCompare(`${b.origin}${b.destination}`);
    else if (sortKey === "rate") cmp = (fa?.currentRateEstimate ?? 0) - (fb?.currentRateEstimate ?? 0);
    else if (sortKey === "trend") cmp = (fa?.weekOverWeekDeltaPct ?? 0) - (fb?.weekOverWeekDeltaPct ?? 0);
    else if (sortKey === "risk") {
      const riskOrder = { high: 2, medium: 1, low: 0, null: -1 };
      cmp = (riskOrder[ta?.riskLevel as keyof typeof riskOrder] ?? -1) - (riskOrder[tb?.riskLevel as keyof typeof riskOrder] ?? -1);
    } else if (sortKey === "forecast") {
      const fOrder = { up: 2, flat: 1, down: 0, null: -1 };
      cmp = (fOrder[fa?.forecastDirection as keyof typeof fOrder] ?? -1) - (fOrder[fb?.forecastDirection as keyof typeof fOrder] ?? -1);
    }

    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortButton = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => handleSort(k)}
      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      {sortKey === k && <span className="text-primary">{sortDir === "asc" ? " ↑" : " ↓"}</span>}
    </button>
  );

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm animate-pulse">Loading your portfolio…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-bold text-lg flex items-center gap-1.5">
              <span className="text-primary">▶</span> LaneBrief
            </Link>
            <nav className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
              <span className="text-foreground font-medium">Portfolio</span>
              <Link href="/dashboard" className="hover:text-foreground transition-colors">Full Dashboard</Link>
              <Link href="/sample-report" className="hover:text-foreground transition-colors">Free Report</Link>
            </nav>
          </div>
          <UserButton />
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Lane Portfolio</h1>
            <p className="text-sm text-muted-foreground mt-0.5">All your lanes. All signals. One screen.</p>
          </div>
          <div className="flex items-center gap-2">
            {attentionCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {attentionCount} lane{attentionCount !== 1 ? "s" : ""} need attention
              </Badge>
            )}
            {attentionCount === 0 && lanes.length > 0 && (
              <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
                Portfolio healthy
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing…" : "↻ Refresh"}
            </Button>
            <Button size="sm" onClick={() => setShowAdd((s) => !s)}>
              {showAdd ? "Cancel" : "+ Add lane"}
            </Button>
          </div>
        </div>

        {/* Add lane form */}
        {showAdd && (
          <form onSubmit={handleAddLane} className="flex flex-wrap gap-2 items-end rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium mb-1">Origin</label>
              <Input
                placeholder="Chicago, IL"
                value={addOrigin}
                onChange={(e) => setAddOrigin(e.target.value)}
                required
                className="h-8 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium mb-1">Destination</label>
              <Input
                placeholder="Dallas, TX"
                value={addDest}
                onChange={(e) => setAddDest(e.target.value)}
                required
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Equipment</label>
              <select
                value={addEquip}
                onChange={(e) => setAddEquip(e.target.value)}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                <option value="dry_van">Dry Van</option>
                <option value="reefer">Reefer</option>
                <option value="flatbed">Flatbed</option>
              </select>
            </div>
            <Button type="submit" size="sm" disabled={adding} className="h-8">
              {adding ? "Adding…" : "Add"}
            </Button>
          </form>
        )}

        {/* Empty state */}
        {lanes.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-3">
            <p className="text-2xl">📦</p>
            <p className="font-medium">No lanes yet</p>
            <p className="text-sm text-muted-foreground">Add your top 3 lanes to build your morning portfolio view.</p>
            <Button size="sm" onClick={() => setShowAdd(true)}>Add your first lane</Button>
          </div>
        )}

        {/* Desktop table */}
        {lanes.length > 0 && (
          <div className="hidden md:block rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left"><SortButton k="lane" label="Lane" /></th>
                  <th className="px-4 py-3 text-right"><SortButton k="rate" label="Spot Rate" /></th>
                  <th className="px-4 py-3 text-right"><SortButton k="trend" label="7d Change" /></th>
                  <th className="px-4 py-3 text-center">Capacity</th>
                  <th className="px-4 py-3 text-center"><SortButton k="risk" label="Carrier Risk" /></th>
                  <th className="px-4 py-3 text-center">Tariff</th>
                  <th className="px-4 py-3 text-center"><SortButton k="forecast" label="Forecast" /></th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedLanes.map((lane) => {
                  const f = forecasts[lane.id];
                  const cap = capacity[lane.id];
                  const t = tender[lane.id];
                  const tariff = getTariffFlag(lane.origin, lane.destination);
                  const trend = trendArrow(f?.weekOverWeekDeltaPct ?? null);
                  const forecast = forecastLabel(f?.forecastDirection ?? null);
                  const isAlert = (f?.weekOverWeekDeltaPct !== null && Math.abs(f?.weekOverWeekDeltaPct ?? 0) > 3) || t?.riskLevel === "high" || tariff?.includes("high");

                  return (
                    <tr key={lane.id} className={`hover:bg-muted/30 transition-colors ${isAlert ? "bg-red-50/40" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          {isAlert && <span className="mt-0.5 h-2 w-2 rounded-full bg-red-500 shrink-0" title="Needs attention" />}
                          <div>
                            <Link href="/dashboard" className="font-medium hover:text-primary transition-colors">
                              {lane.origin} → {lane.destination}
                            </Link>
                            <p className="text-xs text-muted-foreground capitalize">{lane.equipment.replace("_", " ")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {f?.currentRateEstimate
                          ? <span className="font-semibold">${f.currentRateEstimate.toFixed(2)}<span className="text-xs text-muted-foreground font-normal">/mi</span></span>
                          : <span className="text-muted-foreground text-xs">Loading…</span>}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${trend.color}`}>
                        {trend.icon}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {capacityBadge(cap?.capacityLevel ?? null)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {riskBadge(t?.riskLevel ?? null, t?.estimatedAcceptancePct ?? null)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tariff
                          ? <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-red-50 text-red-700">⚠ {tariff}</span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className={`px-4 py-3 text-center font-medium ${forecast.color}`}>
                        {forecast.icon}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleRemoveLane(lane.id)}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove lane"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile card layout */}
        {lanes.length > 0 && (
          <div className="md:hidden space-y-3">
            {sortedLanes.map((lane) => {
              const f = forecasts[lane.id];
              const cap = capacity[lane.id];
              const t = tender[lane.id];
              const tariff = getTariffFlag(lane.origin, lane.destination);
              const trend = trendArrow(f?.weekOverWeekDeltaPct ?? null);
              const forecast = forecastLabel(f?.forecastDirection ?? null);
              const isAlert = (f?.weekOverWeekDeltaPct !== null && Math.abs(f?.weekOverWeekDeltaPct ?? 0) > 3) || t?.riskLevel === "high" || tariff?.includes("high");

              return (
                <div key={lane.id} className={`rounded-xl border border-border p-4 space-y-3 ${isAlert ? "border-red-200 bg-red-50/30" : ""}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      {isAlert && <span className="mt-1 h-2 w-2 rounded-full bg-red-500 shrink-0" />}
                      <div>
                        <Link href="/dashboard" className="font-semibold hover:text-primary transition-colors">
                          {lane.origin} → {lane.destination}
                        </Link>
                        <p className="text-xs text-muted-foreground capitalize">{lane.equipment.replace("_", " ")}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {f?.currentRateEstimate
                        ? <p className="font-bold">${f.currentRateEstimate.toFixed(2)}<span className="text-xs font-normal text-muted-foreground">/mi</span></p>
                        : <p className="text-xs text-muted-foreground">Loading…</p>}
                      <p className={`text-xs font-medium ${trend.color}`}>{trend.icon}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {capacityBadge(cap?.capacityLevel ?? null)}
                    {riskBadge(t?.riskLevel ?? null, t?.estimatedAcceptancePct ?? null)}
                    {tariff && (
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-red-50 text-red-700">⚠ {tariff} tariff</span>
                    )}
                    <span className={`text-xs font-medium ${forecast.color}`}>Forecast: {forecast.icon}</span>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-border/40">
                    <Link href="/dashboard" className="text-xs text-primary hover:underline">
                      Open full brief →
                    </Link>
                    <button
                      onClick={() => handleRemoveLane(lane.id)}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Portfolio score footer */}
        {lanes.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
            <div>
              <span className="font-medium">Portfolio Score: </span>
              {attentionCount === 0
                ? <span className="text-green-700 font-semibold">All clear — no lanes need attention</span>
                : <span className="text-red-700 font-semibold">{attentionCount} of {lanes.length} lanes need attention</span>}
            </div>
            <Link href="/dashboard" className="text-xs text-primary hover:underline whitespace-nowrap">
              View full dashboard with AI briefs →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
