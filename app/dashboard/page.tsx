"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useUser, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AutonomousCoverageBadge } from "@/components/autonomous-coverage-badge";
import { AutonomousCarrierCard, type AutonomousCarrierData, type CarrierRiskData } from "@/components/autonomous-carrier-card";
import { AutonomousCorridorMap } from "@/components/autonomous-corridor-map";
import { RoiDashboard } from "@/components/roi-dashboard";
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

type ForecastData = {
  direction: "up" | "down" | "flat";
  pctChange: number;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  horizon: "7d";
};

type BorderDelay = {
  riskLevel: "high" | "moderate" | "normal";
  crossingPoint: string | null;
  waitMinutes: number | null;
  patternNote: string | null;
  tariffCategoryFlag: boolean;
};

type CapacityData = {
  capacityLevel: "tight" | "moderate" | "loose";
  estimatedCarrierCount: number;
  reasoning: string;
  alternatives: Array<{ origin: string; destination: string; reason: string }>;
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
  const [forecasts, setForecasts] = useState<Record<string, ForecastData | "loading" | "insufficient">>({});
  const [borderDelays, setBorderDelays] = useState<Record<string, BorderDelay | "loading">>({});
  const [capacityData, setCapacityData] = useState<Record<string, CapacityData | "loading">>({});
  const [expandedCapacityLane, setExpandedCapacityLane] = useState<string | null>(null);
  const [carrierRiskScores, setCarrierRiskScores] = useState<Record<string, CarrierRiskData | "loading">>({});
  const [highRiskWarning, setHighRiskWarning] = useState<{ carrier: AutonomousCarrierData; riskData: CarrierRiskData } | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [laneLimit, setLaneLimit] = useState<number | null>(3);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const avOnly = searchParams.get("avOnly") === "1";
  const isNewUser = searchParams.get("newUser") === "1";
  const justUpgraded = searchParams.get("upgraded") === "1";
  const [showGettingStarted, setShowGettingStarted] = useState(isNewUser);
  const [activeTab, setActiveTab] = useState<"lanes" | "roi">("lanes");
  const [shareEmail, setShareEmail] = useState("");
  const [shareStatus, setShareStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [referralCount, setReferralCount] = useState(0);

  const fetchCarrierRiskScores = useCallback((carrierIds: string[]) => {
    for (const carrierId of carrierIds) {
      setCarrierRiskScores((prev) => {
        if (carrierId in prev) return prev;
        // Kick off the fetch
        fetch(`/api/carriers/${carrierId}/risk-score`)
          .then((r) => r.json())
          .then((data: CarrierRiskData & { carrierId: string }) => {
            setCarrierRiskScores((p) => ({
              ...p,
              [carrierId]: {
                score: data.score,
                tier: data.tier,
                signals: data.signals,
                reasoning: data.reasoning,
              },
            }));
          })
          .catch(() => {
            setCarrierRiskScores((p) => {
              const next = { ...p };
              delete next[carrierId];
              return next;
            });
          });
        return { ...prev, [carrierId]: "loading" };
      });
    }
  }, []);

  const fetchAvCoverage = useCallback((laneIds: string[]) => {
    for (const laneId of laneIds) {
      setAvCoverage((prev) => ({ ...prev, [laneId]: "loading" }));
      fetch(`/api/lanes/${laneId}/autonomous-coverage`)
        .then((r) => r.json())
        .then((data) => {
          const loadedCarriers = data.carriers ?? [];
          setAvCoverage((prev) => ({
            ...prev,
            [laneId]: { coverage: data.coverage, carriers: loadedCarriers },
          }));
          if (loadedCarriers.length > 0) {
            fetchCarrierRiskScores(loadedCarriers.map((c: AutonomousCarrierData) => c.id));
          }
        })
        .catch(() => {
          setAvCoverage((prev) => ({ ...prev, [laneId]: { coverage: "NO", carriers: [] } }));
        });
    }
  }, [fetchCarrierRiskScores]);

  const fetchForecasts = useCallback((laneIds: string[]) => {
    for (const laneId of laneIds) {
      setForecasts((prev) => ({ ...prev, [laneId]: "loading" }));
      fetch(`/api/lanes/${laneId}/forecast`)
        .then((r) => r.json())
        .then((data: { laneId: string; forecast: ForecastData | null; insufficientData: boolean }) => {
          if (data.insufficientData || !data.forecast) {
            setForecasts((prev) => ({ ...prev, [laneId]: "insufficient" }));
          } else {
            setForecasts((prev) => ({ ...prev, [laneId]: data.forecast as ForecastData }));
          }
        })
        .catch(() => {
          setForecasts((prev) => {
            const next = { ...prev };
            delete next[laneId];
            return next;
          });
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

  const fetchBorderDelays = useCallback((lanesData: Lane[]) => {
    // Only fetch for US-MX lanes (detected client-side by tariff keywords)
    const MX_KEYWORDS = [
      "laredo", "nuevo laredo", "el paso", "ciudad juarez", "ciudad juárez", "juarez",
      "pharr", "mcallen", "reynosa", "eagle pass", "piedras negras",
      "del rio", "ciudad acuna", "ciudad acuña", "nogales", "otay mesa", "tijuana",
      "calexico", "mexicali",
    ];
    const mxLanes = lanesData.filter((l) => {
      const text = `${l.origin} ${l.destination}`.toLowerCase();
      return MX_KEYWORDS.some((kw) => text.includes(kw));
    });
    for (const lane of mxLanes) {
      setBorderDelays((prev) => ({ ...prev, [lane.id]: "loading" }));
      fetch(`/api/lanes/${lane.id}/border-delay`)
        .then((r) => r.json())
        .then((data: BorderDelay) => {
          setBorderDelays((prev) => ({ ...prev, [lane.id]: data }));
        })
        .catch(() => {
          setBorderDelays((prev) => {
            const next = { ...prev };
            delete next[lane.id];
            return next;
          });
        });
    }
  }, []);

  const fetchCapacityData = useCallback((laneIds: string[]) => {
    for (const laneId of laneIds) {
      setCapacityData((prev) => ({ ...prev, [laneId]: "loading" }));
      fetch(`/api/lanes/${laneId}/capacity-heatmap`)
        .then((r) => r.json())
        .then((data: CapacityData & { laneId: string }) => {
          setCapacityData((prev) => ({
            ...prev,
            [laneId]: {
              capacityLevel: data.capacityLevel,
              estimatedCarrierCount: data.estimatedCarrierCount,
              reasoning: data.reasoning,
              alternatives: data.alternatives,
            },
          }));
        })
        .catch(() => {
          setCapacityData((prev) => {
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
        setIsPro(lanesData.isPro ?? false);
        setLaneLimit(lanesData.laneLimit ?? null);
        setBriefs(briefsData.briefs ?? []);
        setInitialized(true);
        fetch("/api/reports/referral-count").then((r) => r.json()).then((d) => setReferralCount(d.count ?? 0)).catch(() => {});
        fetchAvCoverage(loadedLanes.map((l) => l.id));
        fetchTenderScores(loadedLanes.map((l) => l.id));
        fetchForecasts(loadedLanes.map((l) => l.id));
        fetchBorderDelays(loadedLanes);
        fetchCapacityData(loadedLanes.map((l) => l.id));
      })
      .catch(() => setInitialized(true));
  }, [isLoaded, user, initialized, router, fetchAvCoverage, fetchTenderScores, fetchForecasts, fetchBorderDelays, fetchCapacityData]);

  async function loadLanes() {
    const res = await fetch("/api/lanes");
    if (res.ok) {
      const data = await res.json();
      const loadedLanes: Lane[] = data.lanes ?? [];
      setLanes(loadedLanes);
      setIsPro(data.isPro ?? false);
      setLaneLimit(data.laneLimit ?? null);
      // Fetch coverage and tender scores for any lanes not yet loaded
      const missing = loadedLanes.map((l) => l.id).filter((id) => !(id in avCoverage));
      if (missing.length > 0) fetchAvCoverage(missing);
      const missingScores = loadedLanes.map((l) => l.id).filter((id) => !(id in tenderScores));
      if (missingScores.length > 0) fetchTenderScores(missingScores);
      const missingForecasts = loadedLanes.map((l) => l.id).filter((id) => !(id in forecasts));
      if (missingForecasts.length > 0) fetchForecasts(missingForecasts);
      const missingDelays = loadedLanes.filter((l) => !(l.id in borderDelays));
      if (missingDelays.length > 0) fetchBorderDelays(missingDelays);
      const missingCapacity = loadedLanes.map((l) => l.id).filter((id) => !(id in capacityData));
      if (missingCapacity.length > 0) fetchCapacityData(missingCapacity);
    }
  }

  async function loadBriefs() {
    const res = await fetch("/api/briefs");
    if (res.ok) {
      const data = await res.json();
      setBriefs(data.briefs);
    }
  }

  async function shareReport(e: React.FormEvent) {
    e.preventDefault();
    if (!shareEmail.includes("@")) return;
    setShareStatus("sending");
    try {
      const res = await fetch("/api/reports/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referredEmail: shareEmail }),
      });
      if (res.ok) {
        setShareStatus("sent");
        setShareEmail("");
        setReferralCount((c) => c + 1);
        setTimeout(() => setShareStatus("idle"), 4000);
      } else {
        setShareStatus("error");
        setTimeout(() => setShareStatus("idle"), 3000);
      }
    } catch {
      setShareStatus("error");
      setTimeout(() => setShareStatus("idle"), 3000);
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
        if (data.code === "LANE_LIMIT_REACHED") {
          setShowUpgradeModal(true);
          return;
        }
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

  async function handleUpgradeCheckout() {
    setCheckoutLoading(true);
    try {
      const { STRIPE_PRICES } = await import("@/lib/stripe");
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: STRIPE_PRICES.proMonthly }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Upgrade modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="font-semibold text-lg">You&apos;ve used all 3 free lanes</h2>
              <p className="text-sm text-muted-foreground">
                Upgrade to LaneBrief Pro for unlimited lanes, 7-day forecasts, and your full Portfolio Intelligence View.
              </p>
            </div>
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm space-y-1">
              <div className="font-semibold text-primary">LaneBrief Pro — $79/month</div>
              <ul className="text-muted-foreground space-y-0.5 text-xs">
                <li>✓ Unlimited lanes</li>
                <li>✓ 7-day rate forecasts</li>
                <li>✓ Unlimited carrier risk scores</li>
                <li>✓ Rate alerts + tariff flags</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleUpgradeCheckout}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? "Redirecting..." : "Upgrade to Pro →"}
              </Button>
              <Button variant="outline" onClick={() => setShowUpgradeModal(false)}>
                Later
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Upgraded banner */}
      {justUpgraded && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 text-sm text-center text-primary font-medium">
          Welcome to Pro! All features are now unlocked.
        </div>
      )}
      {/* Nav */}
      <nav className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight">
            LaneBrief
          </Link>
          <div className="flex items-center gap-3">
            {isPro && (
              <Badge className="bg-primary/10 text-primary border border-primary/30 text-xs font-medium hidden sm:inline-flex">
                Pro
              </Badge>
            )}
            {!isPro && (
              <Link
                href="/pricing"
                className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors hidden sm:block"
              >
                Upgrade to Pro
              </Link>
            )}
            <Link
              href="/calculate"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Profit Calculator
            </Link>
            <UserButton />
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-8 sm:space-y-10">
        {/* Getting started callout — shown on first login after onboarding */}
        {showGettingStarted && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-5 py-4 flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="font-semibold text-sm">Welcome to LaneBrief — here's what you can do</p>
              <ul className="space-y-1">
                {[
                  "Generate a brief anytime — hit the button on any lane card",
                  `Add up to ${isPro ? "unlimited" : "3 free"} lanes — use the form below your cards`,
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
          <div className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 w-full sm:w-auto sm:shrink-0 sm:min-w-[220px]">
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

        {/* Tab bar */}
        <div className="flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5 w-fit">
          <button
            onClick={() => setActiveTab("lanes")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "lanes"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Lanes
          </button>
          <button
            onClick={() => setActiveTab("roi")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "roi"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My ROI
          </button>
        </div>

        {/* ROI Dashboard tab */}
        {activeTab === "roi" && <RoiDashboard />}

        {/* Lane cards */}
        {activeTab === "lanes" && <section className="space-y-4">
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
              const forecast = forecasts[lane.id];
              const borderDelay = borderDelays[lane.id];
              const capacity = capacityData[lane.id];
              const capacityExpanded = expandedCapacityLane === lane.id;
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
                        {forecast === "loading" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground animate-pulse">
                            ◌ forecast…
                          </span>
                        )}
                        {forecast && forecast !== "loading" && forecast !== "insufficient" && forecast.direction === "up" && (
                          <span
                            title={`7-day forecast: rates expected UP ${Math.abs(forecast.pctChange).toFixed(1)}% · ${forecast.confidence} confidence · ${forecast.reasoning}`}
                            className="inline-flex items-center gap-1 rounded-full border border-red-300/60 bg-red-50/60 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/20 dark:text-red-400 dark:border-red-600/30 cursor-help"
                          >
                            ▲ +{Math.abs(forecast.pctChange).toFixed(1)}% 7d
                          </span>
                        )}
                        {forecast && forecast !== "loading" && forecast !== "insufficient" && forecast.direction === "down" && (
                          <span
                            title={`7-day forecast: rates expected DOWN ${Math.abs(forecast.pctChange).toFixed(1)}% · ${forecast.confidence} confidence · ${forecast.reasoning}`}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-50/60 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-500 dark:border-emerald-600/30 cursor-help"
                          >
                            ▼ -{Math.abs(forecast.pctChange).toFixed(1)}% 7d
                          </span>
                        )}
                        {forecast && forecast !== "loading" && forecast !== "insufficient" && forecast.direction === "flat" && (
                          <span
                            title={`7-day forecast: rates expected FLAT · ${forecast.confidence} confidence · ${forecast.reasoning}`}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground cursor-help"
                          >
                            → flat 7d
                          </span>
                        )}
                        {borderDelay === "loading" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground animate-pulse">
                            ◌ crossing…
                          </span>
                        )}
                        {borderDelay && borderDelay !== "loading" && borderDelay.riskLevel === "high" && (
                          <span
                            title={`High crossing delay risk${borderDelay.waitMinutes ? ` — est. ${borderDelay.waitMinutes}min wait` : ""} at ${borderDelay.crossingPoint ?? "US-MX border"}. ${borderDelay.patternNote ?? ""}${borderDelay.tariffCategoryFlag ? " Tariff-category cargo elevates CBP inspection probability." : ""}`}
                            className="inline-flex items-center gap-1 rounded-full border border-red-400/60 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400 dark:border-red-500/40 cursor-help"
                          >
                            🔴 High delay risk
                          </span>
                        )}
                        {borderDelay && borderDelay !== "loading" && borderDelay.riskLevel === "moderate" && (
                          <span
                            title={`Moderate crossing delay${borderDelay.waitMinutes ? ` — est. ${borderDelay.waitMinutes}min wait` : ""} at ${borderDelay.crossingPoint ?? "US-MX border"}. ${borderDelay.patternNote ?? ""}`}
                            className="inline-flex items-center gap-1 rounded-full border border-yellow-400/60 bg-yellow-50 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-500 dark:border-yellow-600/40 cursor-help"
                          >
                            🟡 Moderate delay
                          </span>
                        )}
                        {borderDelay && borderDelay !== "loading" && borderDelay.riskLevel === "normal" && borderDelay.crossingPoint && (
                          <span
                            title={`Normal flow at ${borderDelay.crossingPoint}. ${borderDelay.patternNote ?? ""}`}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-50/60 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-500 dark:border-emerald-600/30 cursor-help"
                          >
                            🟢 Normal flow
                          </span>
                        )}
                        {capacity === "loading" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground animate-pulse">
                            ◌ capacity…
                          </span>
                        )}
                        {capacity && capacity !== "loading" && capacity.capacityLevel === "tight" && (
                          <span
                            title={`Tight capacity — est. ${capacity.estimatedCarrierCount} active carriers. ${capacity.reasoning}`}
                            className="inline-flex items-center gap-1 rounded-full border border-red-400/60 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400 dark:border-red-500/40 cursor-help"
                          >
                            🔴 Tight ({capacity.estimatedCarrierCount} carriers)
                          </span>
                        )}
                        {capacity && capacity !== "loading" && capacity.capacityLevel === "moderate" && (
                          <span
                            title={`Moderate capacity — est. ${capacity.estimatedCarrierCount} active carriers. ${capacity.reasoning}`}
                            className="inline-flex items-center gap-1 rounded-full border border-yellow-400/60 bg-yellow-50 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-500 dark:border-yellow-600/40 cursor-help"
                          >
                            🟡 Moderate ({capacity.estimatedCarrierCount} carriers)
                          </span>
                        )}
                        {capacity && capacity !== "loading" && capacity.capacityLevel === "loose" && (
                          <span
                            title={`Loose capacity — est. ${capacity.estimatedCarrierCount}+ active carriers. ${capacity.reasoning}`}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-50/60 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-500 dark:border-emerald-600/30 cursor-help"
                          >
                            🟢 Loose ({capacity.estimatedCarrierCount}+ carriers)
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

                  {/* Capacity alternatives panel (expandable, tight lanes only) */}
                  {capacity && capacity !== "loading" && capacity.capacityLevel === "tight" && capacity.alternatives.length > 0 && (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => setExpandedCapacityLane(capacityExpanded ? null : lane.id)}
                        className="text-xs text-red-700 hover:underline dark:text-red-400"
                      >
                        {capacityExpanded ? "Hide" : "Show"} {capacity.alternatives.length} alternative lane{capacity.alternatives.length > 1 ? "s" : ""} with more capacity
                      </button>
                      {capacityExpanded && (
                        <div className="rounded-md border border-red-200/60 bg-red-50/40 p-2.5 space-y-1.5 dark:border-red-800/30 dark:bg-red-950/10">
                          <p className="text-[10px] font-medium text-red-700 uppercase tracking-wide dark:text-red-400">Capacity alternatives</p>
                          {capacity.alternatives.map((alt, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-[10px] font-medium text-foreground shrink-0">{alt.origin} → {alt.destination}</span>
                              <span className="text-[10px] text-muted-foreground">{alt.reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

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
                          {avData.carriers.map((carrier) => {
                            const riskData = carrierRiskScores[carrier.id];
                            return (
                              <div key={carrier.id}>
                                <AutonomousCarrierCard
                                  carrier={carrier}
                                  corridors={carrier.corridors}
                                  riskData={riskData ?? null}
                                />
                                {riskData && riskData !== "loading" && riskData.tier === "high" && (
                                  <div className="mt-1.5 rounded-md border border-red-300/60 bg-red-50 px-3 py-2 dark:border-red-800/40 dark:bg-red-950/20">
                                    <p className="text-xs font-medium text-red-700 dark:text-red-400">
                                      ⚠ High payment risk — verify before booking
                                    </p>
                                    <p className="text-[11px] text-red-600/80 dark:text-red-400/70 mt-0.5">
                                      {riskData.reasoning}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => setHighRiskWarning({ carrier, riskData })}
                                      className="mt-1.5 text-[11px] text-red-700 underline hover:no-underline dark:text-red-400"
                                    >
                                      View risk details
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
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
            <form onSubmit={addLane} className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-end pt-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Origin</label>
                <Input
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="e.g. Chicago, IL"
                  className="w-full sm:w-44"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Destination</label>
                <Input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Atlanta, GA"
                  className="w-full sm:w-44"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Equipment</label>
                <select
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  className="h-9 w-full sm:w-auto rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="dry_van">Dry Van</option>
                  <option value="reefer">Reefer</option>
                  <option value="flatbed">Flatbed</option>
                </select>
              </div>
              <Button type="submit" disabled={adding} size="sm" className="w-full sm:w-auto">
                {adding ? "Adding…" : "Add Lane"}
              </Button>
            </form>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </section>}

        {/* Brief viewer */}
        {activeTab === "lanes" && selectedBrief && (
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
            <div className="rounded-lg border border-border p-4 sm:p-6 prose prose-sm max-w-none dark:prose-invert overflow-x-auto">
              <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                {selectedBrief.content}
              </pre>
            </div>
          </section>
        )}

        {/* Brief history */}
        {activeTab === "lanes" && briefs.length > 0 && (
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
        {/* Share Weekly Report */}
        {activeTab === "lanes" && lanes.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Share Weekly Report
              </h2>
              {referralCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  You&apos;ve referred {referralCount} colleague{referralCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="rounded-lg border border-border p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Send this week&apos;s freight market report to a colleague — they&apos;ll get a co-branded snapshot of your lanes.
              </p>
              <form onSubmit={shareReport} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  disabled={shareStatus === "sending"}
                  className="flex-1 text-sm"
                />
                <Button
                  type="submit"
                  disabled={shareStatus === "sending" || !shareEmail.includes("@")}
                  size="sm"
                >
                  {shareStatus === "sending" ? "Sending…" : "Send report"}
                </Button>
              </form>
              {shareStatus === "sent" && (
                <p className="text-xs text-emerald-600 font-medium">Report sent! They&apos;ll receive an email with your lane intelligence.</p>
              )}
              {shareStatus === "error" && (
                <p className="text-xs text-destructive">Failed to send — please try again.</p>
              )}
            </div>
          </section>
        )}

        {/* Autonomous corridor coverage map (beta) */}
        {activeTab === "lanes" && autonomousBeta && (
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

      {/* High-risk carrier warning modal */}
      {highRiskWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => setHighRiskWarning(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-red-300 bg-background p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">⚠️</span>
              <div>
                <h2 className="font-semibold text-sm text-red-700 dark:text-red-400">
                  High Payment Risk — {highRiskWarning.carrier.name}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Risk score: {highRiskWarning.riskData.score}/100
                </p>
              </div>
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              {highRiskWarning.riskData.reasoning}
            </p>
            {highRiskWarning.riskData.signals.length > 0 && (
              <div className="rounded-md bg-red-50 border border-red-200/60 px-3 py-2.5 dark:bg-red-950/20 dark:border-red-800/30">
                <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1.5">Risk signals</p>
                <ul className="space-y-1">
                  {highRiskWarning.riskData.signals.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-red-600/80 dark:text-red-400/70">
                      <span className="shrink-0 mt-0.5">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              AI-estimated. Verify with FMCSA SAFER, carrier411, and direct vetting before tendering.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setHighRiskWarning(null)}
                className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Understood — proceed with caution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
