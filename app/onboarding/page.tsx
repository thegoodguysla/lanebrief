"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LaneInput = {
  origin: string;
  destination: string;
  equipment: string;
};

const emptyLane = (): LaneInput => ({
  origin: "",
  destination: "",
  equipment: "dry_van",
});

export default function OnboardingPage() {
  const router = useRouter();
  const [lanes, setLanes] = useState<LaneInput[]>([emptyLane(), emptyLane(), emptyLane()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);

  // Redirect to dashboard if user already has lanes
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filledLanes = lanes.filter((l) => l.origin.trim() && l.destination.trim());
    if (filledLanes.length === 0) {
      setError("Please enter at least one lane.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Save all filled lanes
      const savedLanes: { id: string }[] = [];
      for (const lane of filledLanes) {
        const res = await fetch("/api/lanes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lane),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to save lane");
        }
        const data = await res.json();
        savedLanes.push(data.lane);
      }

      // Auto-generate first brief for lane 1 (moment-of-value)
      if (savedLanes.length > 0) {
        await fetch("/api/briefs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ laneId: savedLanes[0].id }),
        });
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
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
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to LaneBrief</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Enter your top lanes and we&apos;ll generate your first freight intelligence brief
            in seconds — no credit card required.
          </p>
        </div>

        {/* Lane form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {lanes.map((lane, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Lane {i + 1}{i === 0 ? " (required)" : " (optional)"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Origin</label>
                  <Input
                    value={lane.origin}
                    onChange={(e) => updateLane(i, "origin", e.target.value)}
                    placeholder="e.g. Chicago, IL"
                    required={i === 0}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Destination</label>
                  <Input
                    value={lane.destination}
                    onChange={(e) => updateLane(i, "destination", e.target.value)}
                    placeholder="e.g. Atlanta, GA"
                    required={i === 0}
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={submitting} className="w-full" size="lg">
            {submitting ? "Saving lanes & generating your first brief…" : "Get my freight intelligence brief"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            You can add, edit, or remove lanes anytime from your dashboard.
          </p>
        </form>
      </div>
    </div>
  );
}
