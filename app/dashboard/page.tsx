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
// High-risk city keywords sourced from Research Cycle 4 Market Intelligence Report (April 2026)
const MX_HIGH_RISK = [
  // Border crossing city pairs — highest volatility (Mexico electronic Manifest + 1,400+ tariffs)
  "nuevo laredo", "laredo",
  "ciudad juarez", "ciudad juárez", "juarez", "juárez", "el paso",
  "reynosa", "pharr", "mcallen",
  "piedras negras", "eagle pass",
  "ciudad acuna", "ciudad acuña", "del rio",
  "nogales",
  "otay mesa", "tijuana",
];
const MX_MEDIUM_RISK = [
  "calexico", "mexicali",
];
const MX_GENERAL = [
  "mexico", " mx", ",mx", "monterrey", "guadalajara", "cdmx", "mexico city",
  "matamoros", "saltillo", "hermosillo", "chihuahua", "torreon",
];

// US-CA high-risk: auto industry corridors with documented 57% volume spike pre-deadline
const CA_HIGH_RISK = [
  "detroit", "windsor",
  "port huron", "sarnia",
];
const CA_MEDIUM_RISK = [
  "buffalo", "fort erie",
  "blaine", "surrey",
  "pembina", "emerson",
  "sweetgrass", "coutts",
];
const CA_GENERAL = [
  "canada", "ontario", "quebec", "british columbia", "alberta", "manitoba",
  "saskatchewan", "nova scotia", "new brunswick", "prince edward island", "newfoundland",
  " on,", " qc,", " ab,", " mb,", " sk,", " ns,", " nb,", " pe,", " nl,",
  "toronto", "montreal", "vancouver", "calgary", "edmonton", "ottawa", "winnipeg",
  "halifax", "hamilton", "london, on", "kitchener",
];

type TariffFlag = { region: "MX" | "CA"; risk: "high" | "medium" } | null;

function isTariffImpactedLane(lane: { origin: string; destination: string }): TariffFlag {
  const text = `${lane.origin} ${lane.destination}`.toLowerCase();
  if (MX_HIGH_RISK.some((kw) => text.includes(kw))) return { region: "MX", risk: "high" };
  if (CA_HIGH_RISK.some((kw) => text.includes(kw))) return { region: "CA", risk: "high" };
  if (MX_MEDIUM_RISK.some((kw) => text.includes(kw))) return { region: "MX", risk: "medium" };
  if (CA_MEDIUM_RISK.some((kw) => text.includes(kw))) return { region: "CA", risk: "medium" };
  if (MX_GENERAL.some((kw) => text.includes(kw))) return { region: "MX", risk: "medium" };
  if (CA_GENERAL.some((kw) => text.includes(kw))) return { region: "CA", risk: "medium" };
  return null;
}

// USMCA Compliance Flag — Canada 35% tariff on non-USMCA goods (effective 2026)
// Risk level derived from equipment type as a proxy for likely commodity category:
//   flatbed   → steel, aluminum, auto parts, lumber — highest USMCA scrutiny
//   dry_van   → general merchandise, textiles, electronics — moderate exposure
//   reefer    → fresh produce/dairy often USMCA-exempt, processed foods at risk
type USMCAFlag = { risk: "high" | "medium" } | null;

function getUSMCAFlag(lane: { origin: string; destination: string; equipment: string }): USMCAFlag {
  const text = `${lane.origin} ${lane.destination}`.toLowerCase();
  const isCALane =
    CA_HIGH_RISK.some((kw) => text.includes(kw)) ||
    CA_MEDIUM_RISK.some((kw) => text.includes(kw)) ||
    CA_GENERAL.some((kw) => text.includes(kw));
  if (!isCALane) return null;

  // flatbed carries steel/aluminum/auto parts — highest USMCA non-compliance risk
  if (lane.equipment === "flatbed") return { risk: "high" };
  // dry_van general cargo has meaningful non-USMCA exposure (textiles, electronics)
  return { risk: "medium" };
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

type TenderScore = {
  riskLevel: "low" | "medium" | "high";
  estimatedAcceptancePct: number;
  reasoning: string;
  factors: string[];
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
  const [alertMode, setAlertMode] = useState<"instant" | "digest">("digest");
  const [autonomousBeta, setAutonomousBeta] = useState(false);
  const [savingOptIn, setSavingOptIn] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [savingThresholdFor, setSavingThresholdFor] = useState<string | null>(null);
  const [avCoverage, setAvCoverage] = useState<Record<string, AvCoverageData | "loading">>({});
  const [expandedAvLane, setExpandedAvLane] = useState<string | null>(null);
  const [tenderScores, setTenderScores] = useState<Record<string, TenderScore | "loading">>({});
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

  const fetchTenderScores = useCallback((laneIds: string[]) => {
    for (const laneId of laneIds) {
      setTenderScores((prev) => ({ ...prev, [laneId]: "loading" }));
      fetch("/api/tender-acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneId }),
      })
        .then((r) => r.json())
        .then((data: TenderScore & { laneId: string }) => {
          setTenderScores((prev) => ({
            ...prev,
            [laneId]: {
              riskLevel: data.riskLevel,
              estimatedAcceptancePct: data.estimatedAcceptancePct,
              reasoning: data.reasoning,
              factors: data.factors,
            },
          }));
        })
        .catch(() => {
          setTenderScores((prev) => {
            const next = { ...prev };
            delete next[laneId];
            return next;
          });
        });
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !user || initialized) return;

    fetch("/api/user/sync", { method: "POST" })
      .then((r) => r.json())
      .then((userData) => {
        setAlertOptIn(userData.user?.alertOptIn ?? false);
        setAlertMode(userData.user?.alertMode ?? "digest");
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
        fetchTenderScores(loadedLanes.map((l) => l.id));
      })
      .catch(() => setInitialized(true));
  }, [isLoaded, user, initialized, router, fetchAvCoverage, fetchTenderScores]);

  async function loadLanes() {
    const res = await fetch("/api/lanes");
    if (res.ok) {
      const data = await res.json();
      const loadedLanes: Lane[] = data.lanes ?? [];
      setLanes(loadedLanes);
      // Fetch coverage and tender scores for any lanes not yet loaded
      const missing = loadedLanes.map((l) => l.id).filter((id) => !(id in avCoverage));
      if (missing.length > 0) fetchAvCoverage(missing);
      const missingScores = loadedLanes.map((l) => l.id).filter((id) => !(id in tenderScores));
      if (missingScores.length > 0) fetchTenderScores(missingScores);
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

  async function saveAlertMode(mode: "instant" | "digest") {
    setSavingMode(true);
    try {
      const res = await fetch("/api/user/alert-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertMode: mode }),
      });
      if (res.ok) setAlertMode(mode);
    } finally {
      setSavingMode(false);
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
          <div className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 shrink-0 min-w-[220px]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Rate Alerts</p>
                <p className="text-xs text-muted-foreground">Email when lanes hit threshold</p>
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
            {alertOptIn && (
              <div className="flex gap-1 rounded-md border border-border p-0.5">
                <button
                  onClick={() => { if (alertMode !== "instant") saveAlertMode("instant"); }}
                  disabled={savingMode}
                  className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${alertMode === "instant" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Instant
                </button>
                <button
                  onClick={() => { if (alertMode !== "digest") saveAlertMode("digest"); }}
                  disabled={savingMode}
                  className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${alertMode === "digest" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Daily digest
                </button>
              </div>
            )}
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
              const usmcaFlag = getUSMCAFlag(lane);
              const tenderScore = tenderScores[lane.id];
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
                        {tariffFlag && tariffFlag.risk === "high" && (
                          <span
                            title={`Tariff-impacted lane — rates volatile +15-25% (April 2026). High-risk border crossing.`}
                            className="inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-500/40 cursor-help"
                          >
                            ⚠ US-{tariffFlag.region} tariff risk
                          </span>
                        )}
                        {tariffFlag && tariffFlag.risk === "medium" && (
                          <span
                            title={`Tariff-monitored lane — potential rate impact from US-${tariffFlag.region} tariffs (April 2026).`}
                            className="inline-flex items-center gap-1 rounded-full border border-yellow-300/60 bg-yellow-50/60 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-500 dark:border-yellow-600/30 cursor-help"
                          >
                            ◑ US-{tariffFlag.region} tariff-monitored
                          </span>
                        )}
                        {usmcaFlag && usmcaFlag.risk === "high" && (
                          <span
                            title="35% tariff exposure — cargo on this US-CA lane likely faces Canada's non-USMCA tariff. High-risk categories: auto parts, steel, aluminum. Verify USMCA eligibility before quoting."
                            className="inline-flex items-center gap-1 rounded-full border border-red-400/60 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400 dark:border-red-500/40 cursor-help"
                          >
                            ⛔ 35% USMCA risk
                          </span>
                        )}
                        {usmcaFlag && usmcaFlag.risk === "medium" && (
                          <span
                            title="35% tariff exposure possible — cargo on this US-CA lane may not qualify for USMCA treatment. Categories at risk: textiles, electronics, processed foods. Confirm commodity eligibility."
                            className="inline-flex items-center gap-1 rounded-full border border-orange-400/60 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-500/40 cursor-help"
                          >
                            ⚠ USMCA exposure
                          </span>
                        )}
                        <AutonomousCoverageBadge
                          coverage={avData === "loading" ? undefined : avData?.coverage}
                          loading={avData === "loading"}
                        />
                        {tenderScore === "loading" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground animate-pulse">
                            ◌ acceptance…
                          </span>
                        )}
                        {tenderScore && tenderScore !== "loading" && tenderScore.riskLevel === "high" && (
                          <span
                            title={`High tender risk — est. ${tenderScore.estimatedAcceptancePct}% first-tender acceptance. ${tenderScore.reasoning}`}
                            className="inline-flex items-center gap-1 rounded-full border border-red-400/60 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400 dark:border-red-500/40 cursor-help"
                          >
                            ✕ {tenderScore.estimatedAcceptancePct}% acceptance
                          </span>
                        )}
                        {tenderScore && tenderScore !== "loading" && tenderScore.riskLevel === "medium" && (
                          <span
                            title={`Medium tender risk — est. ${tenderScore.estimatedAcceptancePct}% first-tender acceptance. ${tenderScore.reasoning}`}
                            className="inline-flex items-center gap-1 rounded-full border border-orange-300/60 bg-orange-50/60 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-950/20 dark:text-orange-500 dark:border-orange-600/30 cursor-help"
                          >
                            ◑ {tenderScore.estimatedAcceptancePct}% acceptance
                          </span>
                        )}
                        {tenderScore && tenderScore !== "loading" && tenderScore.riskLevel === "low" && (
                          <span
                            title={`Low tender risk — est. ${tenderScore.estimatedAcceptancePct}% first-tender acceptance. ${tenderScore.reasoning}`}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-50/60 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-500 dark:border-emerald-600/30 cursor-help"
                          >
                            ✓ {tenderScore.estimatedAcceptancePct}% acceptance
                          </span>
                        )}
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
