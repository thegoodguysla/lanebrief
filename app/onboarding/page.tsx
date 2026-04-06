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

  // Step 1 — top 3 lanes (primary required, lanes 2-3 optional)
  const [lanes, setLanes] = useState<LaneInput[]>([emptyLane(), emptyLane(), emptyLane()]);
  const [formError, setFormError] = useState("");

  // Step 2/3
  const [primaryLaneId, setPrimaryLaneId] = useState<string | null>(null);
  const [brief, setBrief] = useState<{ title: string; content: string } | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("Saving your lanes…");

  // Step 4
  const [welcomeSent, setWelcomeSent] = useState(false);

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

  function updateLane(index: number, field: keyof LaneInput, value: string) {
    setLanes((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  async function handleLaneSubmit(e: React.FormEvent) {
    e.preventDefault();
    const primary = lanes[0];
    if (!primary.origin.trim() || !primary.destination.trim()) {
      setFormError("Please enter an origin and destination for Lane 1.");
      return;
    }
    setFormError("");
    setStep(2);

    try {
      setLoadingMsg("Saving your lanes…");

      // Save primary lane
      const primaryRes = await fetch("/api/lanes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(primary),
      });
      if (!primaryRes.ok) {
        const d = await primaryRes.json();
        throw new Error(d.error ?? "Failed to save lane");
      }
      const primaryData = await primaryRes.json();
      const laneId: string = primaryData.lane.id;
      setPrimaryLaneId(laneId);

      // Auto-enable alert at 5% threshold on primary lane
      fetch("/api/user/alert-opt-in", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertOptIn: true }),
      }).catch(() => {});

      fetch(`/api/lanes/${laneId}/alert`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertThresholdPct: 5 }),
      }).catch(() => {});

      // Save optional lanes 2 and 3 in background, auto-alert on each
      const optionalLanes = lanes.slice(1).filter((l) => l.origin.trim() && l.destination.trim());
      for (const lane of optionalLanes) {
        fetch("/api/lanes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lane),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.lane?.id) {
              fetch(`/api/lanes/${data.lane.id}/alert`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ alertThresholdPct: 5 }),
              }).catch(() => {});
            }
          })
          .catch(() => {});
      }

      // Generate first brief for primary lane (the value moment)
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
        setStep(4);
      }

      // Fire welcome email in background — brief may or may not be ready, either is fine
      fetch("/api/user/welcome-email", { method: "POST" }).catch(() => {});
      setWelcomeSent(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep(1);
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

        {/* ── Step 1: Top 3 Lanes ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Your top 3 freight lanes</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Enter the lanes you run most. We'll generate your first market intelligence brief in under 60 seconds and set up rate alerts automatically — no credit card needed.
              </p>
            </div>

            <form onSubmit={handleLaneSubmit} className="space-y-4">
              {lanes.map((lane, i) => (
                <div
                  key={i}
                  className={`space-y-3 rounded-lg border p-4 ${i === 0 ? "border-border" : "border-border/50"}`}
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Lane {i + 1}{i === 0 ? " (Primary)" : " — Optional"}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Origin</label>
                      <Input
                        value={lane.origin}
                        onChange={(e) => updateLane(i, "origin", e.target.value)}
                        placeholder={
                          i === 0 ? "e.g. Chicago, IL" : i === 1 ? "e.g. Dallas, TX" : "e.g. Los Angeles, CA"
                        }
                        autoFocus={i === 0}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Destination</label>
                      <Input
                        value={lane.destination}
                        onChange={(e) => updateLane(i, "destination", e.target.value)}
                        placeholder={
                          i === 0 ? "e.g. Atlanta, GA" : i === 1 ? "e.g. Houston, TX" : "e.g. Phoenix, AZ"
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Equipment</label>
                    <select
                      value={lane.equipment}
                      onChange={(e) => updateLane(i, "equipment", e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="dry_van">Dry Van</option>
                      <option value="reefer">Reefer</option>
                      <option value="flatbed">Flatbed</option>
                    </select>
                  </div>
                </div>
              ))}

              <div className="rounded-lg border border-border/40 bg-muted/20 px-4 py-3 flex items-start gap-2">
                <span className="text-primary text-xs mt-0.5">✓</span>
                <p className="text-xs text-muted-foreground">
                  Rate alerts will be automatically enabled at a <strong>5% threshold</strong> for each
                  lane — adjust anytime on your dashboard.
                </p>
              </div>

              {formError && <p className="text-sm text-destructive">{formError}</p>}

              <Button type="submit" className="w-full" size="lg">
                Analyze my lanes →
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
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  ✓
                </span>
                <h1 className="text-2xl font-semibold tracking-tight">Your brief is ready</h1>
              </div>
              <p className="text-muted-foreground text-sm">
                {lanes[0].origin} → {lanes[0].destination} · {lanes[0].equipment.replace(/_/g, " ")}
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

            {welcomeSent && (
              <div className="rounded-lg border border-border/40 bg-muted/20 px-4 py-3 flex items-start gap-2">
                <span className="text-xs mt-0.5">✉</span>
                <p className="text-xs text-muted-foreground">
                  This brief has been sent to your email — this is exactly what you'll get weekly for each of your lanes.
                </p>
              </div>
            )}

            <Button onClick={() => setStep(4)} className="w-full" size="lg">
              Continue →
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

        {/* ── Step 4: All Set ── */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  ✓
                </span>
                <h1 className="text-2xl font-semibold tracking-tight">You're all set</h1>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                LaneBrief is now tracking your lanes. Here's what happens next.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  icon: "📊",
                  title: "Weekly rate digests",
                  desc: "Every Monday morning — rate movements, capacity signals, and tariff flags for all your lanes.",
                },
                {
                  icon: "⚡",
                  title: "Instant rate alerts at 5%",
                  desc: "Get notified when any lane moves more than 5%. Adjust thresholds per lane anytime on your dashboard.",
                },
                {
                  icon: "🔄",
                  title: "Regenerate briefs anytime",
                  desc: "Pull fresh market intel on demand from your dashboard, any time you need it.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-border/50 p-4 flex items-start gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {welcomeSent && (
              <div className="rounded-lg border border-border/40 bg-muted/20 px-4 py-3 flex items-start gap-2">
                <span className="text-xs mt-0.5">✉</span>
                <p className="text-xs text-muted-foreground">
                  Check your inbox — your first brief has been sent to your email.
                </p>
              </div>
            )}

            <Button
              onClick={() => router.push("/dashboard?newUser=1")}
              className="w-full"
              size="lg"
            >
              Go to my dashboard →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
