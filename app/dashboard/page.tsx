"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useUser, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AutonomousCoverageBadge } from "@/components/autonomous-coverage-badge";
import { AutonomousCarrierCard, type AutonomousCarrierData } from "@/components/autonomous-carrier-card";
import { AutonomousCorridorMap } from "@/components/autonomous-corridor-map";
import Link from "next/link";

// Detect if a lane crosses the US-MX or US-CA border for tariff impact flagging
const MX_INDICATORS = [
  "mexico", " mx", ",mx", "monterrey", "guadalajara", "cdmx", "mexico city",
  "tijuana", "juarez", "ciudad juarez", "nuevo laredo", "reynosa", "matamoros",
  "nogales", "mexicali", "saltillo", "hermosillo", "chihuahua", "torreon",
];
const CA_INDICATORS = [
  "canada", "ontario", "quebec", "british columbia", "alberta", "manitoba",
  "saskatchewan", "nova scotia", "new brunswick", "prince edward island", "newfoundland",
  " on,", " qc,", " ab,", " mb,", " sk,", " ns,", " nb,", " pe,", " nl,",
  "toronto", "montreal", "vancouver", "calgary", "edmonton", "ottawa", "winnipeg",
  "halifax", "hamilton", "london, on", "kitchener", "windsor, on",
];

function isTariffImpactedLane(lane: { origin: string; destination: string }): "MX" | "CA" | null {
  const text = `${lane.origin} ${lane.destination}`.toLowerCase();
  if (MX_INDICATORS.some((kw) => text.includes(kw))) return "MX";
  if (CA_INDICATORS.some((kw) => text.includes(kw))) return "CA";
  return null;
}

type Lane = {
  id: string;
  origin: string;
  destination: string;
  equipment: string;
  alertThresholdPct: number;
};

type AvCoverageData = {
  coverage: "YES" | "NO" | "PARTIAL";
  carriers: Array<AutonomousCarrierData & {
    corridors?: Array<{ originRegion: string; destRegion: string; highwayId: string | null; isCertified: boolean }>;
  }>;
};

type Brief = {
  id: string;
  laneId: string | null;
  title: string;
  content: string;
  version: number;
  generatedAt: string;
};

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [equipment, setEquipment] = useState("dry_van");
  const [adding, setAdding] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [alertOptIn, setAlertOptIn] = useState(false);
  const [autonomousBeta, setAutonomousBeta] = useState(false);
  const [savingOptIn, setSavingOptIn] = useState(false);
  const [savingThresholdFor, setSavingThresholdFor] = useState<string | null>(null);
  const [avCoverage, setAvCoverage] = useState<Record<string, AvCoverageData | "loading">>({});
  const [expandedAvLane, setExpandedAvLane] = useState<string | null>(null);
  const avOnly = searchParams.get("avOnly") === "1";
  const isNewUser = searchParams.get("newUser") === "1";
  const [showGettingStarted, setShowGettingStarted] = useState(isNewUser);

  const fetchAvCoverage = useCallback((laneIds: string[]) => {
    for (const laneId of laneIds) {
      setAvCoverage((prev) => ({ ...prev, [laneId]: "loading" }));
      fetch(`/api/lanes/${laneId}/autonomous-coverage`)
        .then((r) => r.json())
        .then((data) => {
          setAvCoverage((prev) => ({
            ...prev,
            [laneId]: { coverage: data.coverage, carriers: data.carriers ?? [] },
          }));
        })
        .catch(() => {
          setAvCoverage((prev) => ({ ...prev, [laneId]: { coverage: "NO", carriers: [] } }));
        });
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !user || initialized) return;

    fetch("/api/user/sync", { method: "POST" })
      .then((r) => r.json())
      .then((userData) => {
        setAlertOptIn(userData.user?.alertOptIn ?? false);
        setAutonomousBeta(userData.user?.autonomousBeta ?? false);
        return Promise.all([
          fetch("/api/lanes").then((r) => r.json()),
          fetch("/api/briefs").then((r) => r.json()),
        ]);
      })
      .then(([lanesData, briefsData]) => {
        if (lanesData.lanes?.length === 0) {
          router.replace("/onboarding");
          return;
        }
        const loadedLanes: Lane[] = lanesData.lanes ?? [];
        setLanes(loadedLanes);
        setBriefs(briefsData.briefs ?? []);
        setInitialized(true);
        fetchAvCoverage(loadedLanes.map((l) => l.id));
      })
      .catch(() => setInitialized(true));
  }, [isLoaded, user, initialized, router, fetchAvCoverage]);

  async function loadLanes() {
    const res = await fetch("/api/lanes");
    if (res.ok) {
      const data = await res.json();
      const loadedLanes: Lane[] = data.lanes ?? [];
      setLanes(loadedLanes);
      // Fetch coverage for any lanes not yet loaded
      const missing = loadedLanes.map((l) => l.id).filter((id) => !(id in avCoverage));
      if (missing.length > 0) fetchAvCoverage(missing);
    }
  }

  async function loadBriefs() {
    const res = await fetch("/api/briefs");
    if (res.ok) {
      const data = await res.json();
      setBriefs(data.briefs);
    }
  }

  async function addLane(e: React.FormEvent) {
    e.preventDefault();
    if (!origin || !destination) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/lanes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, equipment }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to add lane");
        return;
      }
      setOrigin("");
      setDestination("");
      await loadLanes();
    } finally {
      setAdding(false);
    }
  }

  async function removeLane(laneId: string) {
    await fetch("/api/lanes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ laneId }),
    });
    setLanes((prev) => prev.filter((l) => l.id !== laneId));
  }

  async function generateBrief(laneId: string) {
    setGeneratingFor(laneId);
    try {
      const res = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneId }),
      });
      if (res.ok) {
        const data = await res.json();
        setBriefs((prev) => [data.brief, ...prev]);
        setSelectedBrief(data.brief);
        await loadBriefs();
      }
    } finally {
      setGeneratingFor(null);
    }
  }

  async function toggleAlertOptIn() {
    setSavingOptIn(true);
    const next = !alertOptIn;
    try {
      const res = await fetch("/api/user/alert-opt-in", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertOptIn: next }),
      });
      if (res.ok) setAlertOptIn(next);
    } finally {
      setSavingOptIn(false);
    }
  }

  async function saveThreshold(laneId: string, pct: number) {
    setSavingThresholdFor(laneId);
    try {
      const res = await fetch(`/api/lanes/${laneId}/alert`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertThresholdPct: pct }),
      });
      if (res.ok) {
        setLanes((prev) =>
          prev.map((l) => (l.id === laneId ? { ...l, alertThresholdPct: pct } : l))
        );
      }
    } finally {
      setSavingThresholdFor(null);
    }
  }

  function toggleAvFilter() {
    const params = new URLSearchParams(searchParams.toString());
    if (avOnly) {
      params.delete("avOnly");
    } else {
      params.set("avOnly", "1");
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  // Get the most recent brief for a given lane
  function latestBriefForLane(laneId: string): Brief | undefined {
    return briefs.find((b) => b.laneId === laneId);
  }

  const displayedLanes = avOnly
    ? lanes.filter((l) => {
        const cov = avCoverage[l.id];
        return cov !== "loading" && cov?.coverage !== "NO" && cov != null;
      })
    : lanes;

  if (!isLoaded || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight">
            LaneBrief
          </Link>
          <UserButton />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {/* Getting started callout — shown on first login after onboarding */}
        {showGettingStarted && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-5 py-4 flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="font-semibold text-sm">Welcome to LaneBrief — here's what you can do</p>
              <ul className="space-y-1">
                {[
                  "Generate a brief anytime — hit the button on any lane card",
                  "Add up to 5 lanes — use the form below your cards",
                  "Enable weekly alerts — toggle in the top-right to get Monday rate digests",
                  "Download a shipper pitch PDF — link appears under each brief",
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2">
                    <span className="text-primary text-xs mt-0.5 shrink-0">→</span>
                    <span className="text-xs text-muted-foreground">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setShowGettingStarted(false)}
              className="text-xs text-muted-foreground hover:text-foreground shrink-0 transition-colors"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">
              {user?.firstName ? `${user.firstName}'s Lane Dashboard` : "Your Lane Dashboard"}
            </h1>
            <p className="text-muted-foreground mt-1">
              Track up to 5 lanes. Generate AI-powered freight intelligence briefs anytime.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 shrink-0">
            <div>
              <p className="text-sm font-medium">Weekly Rate Alerts</p>
              <p className="text-xs text-muted-foreground">Email digest when lanes hit threshold</p>
            </div>
            <button
              onClick={toggleAlertOptIn}
              disabled={savingOptIn}
              aria-pressed={alertOptIn}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${alertOptIn ? "bg-primary" : "bg-muted"} disabled:opacity-50`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${alertOptIn ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </div>
        </div>

        {/* Lane cards */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              My Lanes ({lanes.length}/5)
            </h2>
            <button
              type="button"
              onClick={toggleAvFilter}
              aria-pressed={avOnly}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                avOnly
                  ? "border-emerald-400/60 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                  : "border-border text-muted-foreground hover:border-emerald-400/40 hover:text-foreground"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${avOnly ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
              Autonomous coverage only
            </button>
          </div>

          {avOnly && displayedLanes.length === 0 && (
            <p className="text-sm text-muted-foreground">No lanes with autonomous coverage yet. Coverage data updates daily.</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayedLanes.map((lane) => {
              const brief = latestBriefForLane(lane.id);
              const isGenerating = generatingFor === lane.id;
              const avData = avCoverage[lane.id];
              const avExpanded = expandedAvLane === lane.id;
              const tariffFlag = isTariffImpactedLane(lane);
              return (
                <div
                  key={lane.id}
                  className="rounded-lg border border-border p-4 flex flex-col gap-3 hover:border-border/80 transition-colors"
                >
                  {/* Lane header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium text-sm leading-snug">
                        {lane.origin} → {lane.destination}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-xs capitalize">
                          {lane.equipment.replace("_", " ")}
                        </Badge>
                        {tariffFlag && (
                          <span
                            title={`Tariff-impacted lane — rates volatile +15-25% (April 2026)`}
                            className="inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-500/40 cursor-help"
                          >
                            ⚠ US-{tariffFlag} tariff risk
                          </span>
                        )}
                        <AutonomousCoverageBadge
                          coverage={avData === "loading" ? undefined : avData?.coverage}
                          loading={avData === "loading"}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeLane(lane.id)}
                      className="text-muted-foreground hover:text-destructive text-xs shrink-0"
                    >
                      Remove
                    </button>
                  </div>

                  {/* AV carrier cards (expandable) */}
                  {avData !== "loading" && avData && avData.coverage !== "NO" && avData.carriers.length > 0 && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setExpandedAvLane(avExpanded ? null : lane.id)}
                        className="text-xs text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        {avExpanded ? "Hide" : "View"} {avData.carriers.length} autonomous carrier{avData.carriers.length > 1 ? "s" : ""}
                      </button>
                      {avExpanded && (
                        <div className="space-y-2">
                          {avData.carriers.map((carrier) => (
                            <AutonomousCarrierCard
                              key={carrier.id}
                              carrier={carrier}
                              corridors={carrier.corridors}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Brief preview */}
                  {brief ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          v{brief.version}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(brief.generatedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                        {brief.content.replace(/#+\s/g, "").replace(/\*\*/g, "").slice(0, 180)}…
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedBrief(brief)}
                          className="text-xs text-primary hover:underline"
                        >
                          Read full brief
                        </button>
                        <span className="text-muted-foreground">·</span>
                        <Link
                          href={`/api/pdf/pitch?laneId=${lane.id}`}
                          target="_blank"
                          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                        >
                          Shipper pitch PDF
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No brief yet for this lane.</p>
                  )}

                  {/* Alert threshold */}
                  {alertOptIn && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-muted-foreground">Alert threshold</label>
                        <span className="text-xs font-medium">{lane.alertThresholdPct}%</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={50}
                        step={1}
                        value={lane.alertThresholdPct}
                        onChange={(e) =>
                          setLanes((prev) =>
                            prev.map((l) =>
                              l.id === lane.id
                                ? { ...l, alertThresholdPct: Number(e.target.value) }
                                : l
                            )
                          )
                        }
                        onMouseUp={(e) => saveThreshold(lane.id, Number((e.target as HTMLInputElement).value))}
                        onTouchEnd={(e) => saveThreshold(lane.id, Number((e.target as HTMLInputElement).value))}
                        disabled={savingThresholdFor === lane.id}
                        className="w-full accent-primary"
                      />
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant={brief ? "outline" : "default"}
                    onClick={() => generateBrief(lane.id)}
                    disabled={isGenerating}
                    className="mt-auto"
                  >
                    {isGenerating ? "Generating…" : brief ? "Regenerate Brief" : "Generate Brief"}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Add lane form */}
          {lanes.length < 5 && (
            <form onSubmit={addLane} className="flex flex-wrap gap-2 items-end pt-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Origin</label>
                <Input
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="e.g. Chicago, IL"
                  className="w-44"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Destination</label>
                <Input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Atlanta, GA"
                  className="w-44"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Equipment</label>
                <select
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="dry_van">Dry Van</option>
                  <option value="reefer">Reefer</option>
                  <option value="flatbed">Flatbed</option>
                </select>
              </div>
              <Button type="submit" disabled={adding} size="sm">
                {adding ? "Adding…" : "Add Lane"}
              </Button>
            </form>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </section>

        {/* Brief viewer */}
        {selectedBrief && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Brief: {selectedBrief.title}
              </h2>
              <button
                onClick={() => setSelectedBrief(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
            <div className="rounded-lg border border-border p-6 prose prose-sm max-w-none dark:prose-invert">
              <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                {selectedBrief.content}
              </pre>
            </div>
          </section>
        )}

        {/* Brief history */}
        {briefs.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Brief History
            </h2>
            <div className="divide-y divide-border rounded-lg border border-border">
              {briefs.map((brief) => (
                <button
                  key={brief.id}
                  onClick={() => setSelectedBrief(brief)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-sm font-medium">{brief.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    v{brief.version} ·{" "}
                    {new Date(brief.generatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}
        {/* Autonomous corridor coverage map (beta) */}
        {autonomousBeta && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Autonomous Corridor Coverage Map
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Sun Belt corridors served by Aurora, Gatik, and Kodiak — beta access
              </p>
            </div>
            <AutonomousCorridorMap />
          </section>
        )}
      </main>
    </div>
  );
}
