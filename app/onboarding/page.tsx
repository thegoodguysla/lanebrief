"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type WizardStep = 1 | 2 | 3 | 4;

type LaneInput = { origin: string; destination: string; equipment: string };

const emptyLane = (): LaneInput => ({ origin: "", destination: "", equipment: "dry_van" });

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [checked, setChecked] = useState(false);

  // Step 1
  const [primary, setPrimary] = useState<LaneInput>(emptyLane());
  const [extras, setExtras] = useState<LaneInput[]>([emptyLane(), emptyLane()]);
  const [showExtras, setShowExtras] = useState(false);
  const [formError, setFormError] = useState("");

  // Step 2/3
  const [savedLaneId, setSavedLaneId] = useState<string | null>(null);
  const [brief, setBrief] = useState<{ title: string; content: string } | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("Saving your lane…");

  // Step 4
  const [alertOptIn, setAlertOptIn] = useState(false);
  const [threshold, setThreshold] = useState(5);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Redirect if user already has lanes
  useEffect(() => {
    fetch("/api/user/sync", { method: "POST" })
      .then(() => fetch("/api/lanes"))
      .then((r) => r.json())
      .then((data) => {
        if (data.lanes?.length > 0) {
          router.replace("/dashboard");
        } else {
          setChecked(true);
        }
      })
      .catch(() => setChecked(true));
  }, [router]);

  function updateExtra(index: number, field: keyof LaneInput, value: string) {
    setExtras((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  async function handleLaneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!primary.origin.trim() || !primary.destination.trim()) {
      setFormError("Please enter an origin and destination for your primary lane.");
      return;
    }
    setFormError("");
    setStep(2);

    try {
      setLoadingMsg("Saving your lane…");
      const laneRes = await fetch("/api/lanes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(primary),
      });
      if (!laneRes.ok) {
        const d = await laneRes.json();
        throw new Error(d.error ?? "Failed to save lane");
      }
      const laneData = await laneRes.json();
      const laneId: string = laneData.lane.id;
      setSavedLaneId(laneId);

      // Save extra lanes in background — don't block on them
      const filledExtras = extras.filter((l) => l.origin.trim() && l.destination.trim());
      for (const extra of filledExtras) {
        fetch("/api/lanes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(extra),
        }).catch(() => {});
      }

      // Generate first brief (the value moment)
      setLoadingMsg(`Analyzing ${primary.origin} → ${primary.destination}…`);
      const briefRes = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneId }),
      });
      if (briefRes.ok) {
        const briefData = await briefRes.json();
        setBrief(briefData.brief);
        setStep(3);
      } else {
        // Brief failed — skip to alerts step
        setStep(4);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep(1);
    }
  }

  async function handleAlertSave() {
    setSavingPrefs(true);
    try {
      if (alertOptIn) {
        await fetch("/api/user/alert-opt-in", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alertOptIn: true }),
        });
        if (savedLaneId) {
          await fetch(`/api/lanes/${savedLaneId}/alert`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ alertThresholdPct: threshold }),
          });
        }
      }
      router.push("/dashboard?newUser=1");
    } finally {
      setSavingPrefs(false);
    }
  }

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">

        {/* Logo + progress */}
        <div className="space-y-4">
          <p className="text-sm font-semibold tracking-tight text-primary">▶ LaneBrief</p>
          <div className="flex items-center gap-1.5">
            {([1, 2, 3, 4] as const).map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Step {step} of 4</p>
        </div>

        {/* ── Step 1: Lane Setup ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Set up your first lane</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Enter your primary freight lane. We'll generate your first market intelligence brief in under 60 seconds — no credit card needed.
              </p>
            </div>

            <form onSubmit={handleLaneSubmit} className="space-y-5">
              <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Primary Lane
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Origin</label>
                    <Input
                      value={primary.origin}
                      onChange={(e) => setPrimary((p) => ({ ...p, origin: e.target.value }))}
                      placeholder="e.g. Chicago, IL"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Destination</label>
                    <Input
                      value={primary.destination}
                      onChange={(e) => setPrimary((p) => ({ ...p, destination: e.target.value }))}
                      placeholder="e.g. Atlanta, GA"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Equipment</label>
                  <select
                    value={primary.equipment}
                    onChange={(e) => setPrimary((p) => ({ ...p, equipment: e.target.value }))}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="dry_van">Dry Van</option>
                    <option value="reefer">Reefer</option>
                    <option value="flatbed">Flatbed</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowExtras((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showExtras ? "− Hide" : "+ Add"} more lanes (optional)
              </button>

              {showExtras &&
                extras.map((lane, i) => (
                  <div key={i} className="space-y-3 rounded-lg border border-border/50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Lane {i + 2} (optional)
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Origin</label>
                        <Input
                          value={lane.origin}
                          onChange={(e) => updateExtra(i, "origin", e.target.value)}
                          placeholder="e.g. Dallas, TX"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Destination</label>
                        <Input
                          value={lane.destination}
                          onChange={(e) => updateExtra(i, "destination", e.target.value)}
                          placeholder="e.g. Houston, TX"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Equipment</label>
                      <select
                        value={lane.equipment}
                        onChange={(e) => updateExtra(i, "equipment", e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="dry_van">Dry Van</option>
                        <option value="reefer">Reefer</option>
                        <option value="flatbed">Flatbed</option>
                      </select>
                    </div>
                  </div>
                ))}

              {formError && <p className="text-sm text-destructive">{formError}</p>}

              <Button type="submit" className="w-full" size="lg">
                Analyze this lane →
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Your first freight intelligence brief generates in under 60 seconds.
              </p>
            </form>
          </div>
        )}

        {/* ── Step 2: Generating ── */}
        {step === 2 && (
          <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <div className="space-y-2">
              <p className="font-medium">{loadingMsg}</p>
              <p className="text-sm text-muted-foreground">
                Pulling current market data and generating your brief…
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/30 px-5 py-4 text-left space-y-2 w-full max-w-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">What's included</p>
              {[
                "Spot rate trend vs. market average",
                "Capacity signal (tight / normal / loose)",
                "Seasonal risk flags",
                "Actionable intel bullets",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <span className="text-primary text-xs mt-0.5">✓</span>
                  <p className="text-xs text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: First Insight ── */}
        {step === 3 && brief && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">✓</span>
                <h1 className="text-2xl font-semibold tracking-tight">Your brief is ready</h1>
              </div>
              <p className="text-muted-foreground text-sm">
                {primary.origin} → {primary.destination} · {primary.equipment.replace(/_/g, " ")}
              </p>
            </div>

            <div className="rounded-lg border border-primary/30 overflow-hidden">
              <div className="bg-primary/10 px-4 py-2.5 border-b border-primary/20">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Intelligence Brief — First Look
                </p>
              </div>
              <div className="p-5 space-y-3">
                <h2 className="font-semibold text-sm leading-snug">{brief.title}</h2>
                <div className="max-h-56 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground leading-relaxed">
                    {brief.content.length > 900
                      ? brief.content.slice(0, 900) + "…\n\n[Full brief available on dashboard]"
                      : brief.content}
                  </pre>
                </div>
              </div>
            </div>

            <Button onClick={() => setStep(4)} className="w-full" size="lg">
              Set up rate alerts →
            </Button>
            <button
              type="button"
              onClick={() => router.push("/dashboard?newUser=1")}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip — go straight to my dashboard
            </button>
          </div>
        )}

        {/* ── Step 4: Alert Preferences ── */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Stay ahead of the market</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Get an email when your lane rates move significantly — so you can act before your competition.
              </p>
            </div>

            <div className="rounded-lg border border-border p-5 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">Weekly Rate Alerts</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Monday digest with rate movements on your lanes
                  </p>
                </div>
                <button
                  onClick={() => setAlertOptIn((v) => !v)}
                  aria-pressed={alertOptIn}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${alertOptIn ? "bg-primary" : "bg-muted"}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${alertOptIn ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div>

              {alertOptIn && (
                <div className="space-y-3 pt-1 border-t border-border">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">
                      Alert me when rates move more than
                    </label>
                    <span className="text-sm font-semibold">{threshold}%</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    step={1}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1% — sensitive</span>
                    <span>20% — major moves only</span>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">What's on your dashboard</p>
              {[
                "Full brief for every saved lane",
                "Regenerate briefs anytime",
                "Autonomous carrier coverage data",
                "Add up to 5 lanes total",
              ].map((tip) => (
                <div key={tip} className="flex items-center gap-2">
                  <span className="text-primary text-xs">→</span>
                  <p className="text-xs text-muted-foreground">{tip}</p>
                </div>
              ))}
            </div>

            <Button onClick={handleAlertSave} disabled={savingPrefs} className="w-full" size="lg">
              {savingPrefs ? "Saving…" : "Go to my dashboard →"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
