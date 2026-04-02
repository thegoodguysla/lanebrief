"use client";

import { useEffect, useState } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type Lane = {
  id: string;
  origin: string;
  destination: string;
  equipment: string;
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
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [equipment, setEquipment] = useState("dry_van");
  const [adding, setAdding] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null);
  const [error, setError] = useState("");
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (isLoaded && user && !synced) {
      fetch("/api/user/sync", { method: "POST" })
        .then(() => setSynced(true))
        .then(() => Promise.all([loadLanes(), loadBriefs()]));
    }
  }, [isLoaded, user, synced]);

  async function loadLanes() {
    const res = await fetch("/api/lanes");
    if (res.ok) {
      const data = await res.json();
      setLanes(data.lanes);
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
      }
    } finally {
      setGeneratingFor(null);
    }
  }

  if (!isLoaded) {
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
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold">Your Lane Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Track up to 5 lanes. Generate AI-powered freight intelligence briefs anytime.
          </p>
        </div>

        {/* Add lane form */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            My Lanes ({lanes.length}/5)
          </h2>
          {lanes.length < 5 && (
            <form onSubmit={addLane} className="flex flex-wrap gap-2 items-end">
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

          {/* Lane list */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lanes.map((lane) => (
              <div
                key={lane.id}
                className="rounded-lg border border-border p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">
                      {lane.origin} → {lane.destination}
                    </p>
                    <Badge variant="outline" className="mt-1 text-xs capitalize">
                      {lane.equipment.replace("_", " ")}
                    </Badge>
                  </div>
                  <button
                    onClick={() => removeLane(lane.id)}
                    className="text-muted-foreground hover:text-destructive text-xs"
                  >
                    Remove
                  </button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateBrief(lane.id)}
                  disabled={generatingFor === lane.id}
                >
                  {generatingFor === lane.id ? "Generating…" : "Generate Brief"}
                </Button>
              </div>
            ))}
            {lanes.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-3">
                No lanes yet. Add your first lane above.
              </p>
            )}
          </div>
        </section>

        {/* Brief viewer */}
        {selectedBrief && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Latest Brief
              </h2>
              <button
                onClick={() => setSelectedBrief(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
            <div className="rounded-lg border border-border p-6 prose prose-sm max-w-none dark:prose-invert">
              <h3 className="font-semibold mb-3">{selectedBrief.title}</h3>
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
      </main>
    </div>
  );
}
