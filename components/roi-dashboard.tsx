"use client";

import { useEffect, useState, useCallback } from "react";
import type { RoiData, ActivityEvent } from "@/app/api/roi/route";

function fmt$$(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ActivityIcon({ type }: { type: ActivityEvent["type"] }) {
  if (type === "alert")
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-600 text-sm border border-amber-200 dark:bg-amber-950/30 dark:border-amber-700">
        ▲
      </span>
    );
  if (type === "brief")
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm border border-primary/20">
        ▶
      </span>
    );
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm border border-border">
      ✓
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-4 space-y-1 ${
        accent
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-background"
      }`}
    >
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        {label}
      </p>
      <p
        className={`text-2xl font-bold ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function RoiDashboard() {
  const [data, setData] = useState<RoiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/roi")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load ROI data");
        return r.json();
      })
      .then((d: RoiData) => setData(d))
      .catch(() => setError("Could not load ROI data. Try refreshing."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handlePrint() {
    window.print();
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/dashboard`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Loading ROI data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-5 py-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const hasSomeData = data.snapshotCount > 0 || data.briefsGenerated > 0;
  const benchmarkPct = Math.round((data.benchmarkRatio - 1) * 100);
  const benchmarkLabel =
    data.benchmarkRatio >= 1.1
      ? `${Math.round(data.benchmarkRatio * 10) / 10}× the average LaneBrief user`
      : data.benchmarkRatio < 0.9
      ? "below the average LaneBrief user"
      : "on par with the average LaneBrief user";

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Value summary card */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Your LaneBrief ROI — Last 30 Days</p>
            {!hasSomeData && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Data builds as you generate briefs and rate checks.
              </p>
            )}
          </div>
          <div className="flex gap-2 print:hidden">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              {copied ? "Copied!" : "Share link"}
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              Export PDF
            </button>
          </div>
        </div>

        <div className="p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Hours saved this week"
            value={`${data.weeklyHoursSaved}h`}
            sub={`${data.monthlyHoursSaved}h this month`}
            accent
          />
          <StatCard
            label="Rate exposure flagged"
            value={fmt$$(data.rateExposureFlagged)}
            sub={`across ${data.snapshotCount} rate checks`}
          />
          <StatCard
            label="Tenders protected"
            value={String(data.tendersProtected)}
            sub="by risk assessments"
          />
          <StatCard
            label="Capacity warnings"
            value={String(data.capacityWarnings)}
            sub="tight-market alerts"
          />
        </div>
      </div>

      {/* Monthly ROI estimate */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 px-5 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Estimated Monthly Value
            </p>
            <p className="text-3xl font-bold text-primary mt-1">
              {fmt$$(data.monthlyRoiEstimate)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Based on {data.monthlyHoursSaved}h labor saved ({fmt$$(
                Math.round((data.monthlyHoursSaved * 50) / 10) * 10
              )} at $50/hr) + estimated margin protection from {data.snapshotCount} rate alerts
            </p>
          </div>
          <div className="rounded-md border border-primary/20 bg-background px-4 py-3 text-sm">
            <p className="font-medium text-foreground">
              {fmt$$(data.monthlyRoiEstimate)} value
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              vs $199/mo subscription
            </p>
            {data.monthlyRoiEstimate >= 199 && (
              <p className="text-xs text-primary font-medium mt-1">
                {Math.round(data.monthlyRoiEstimate / 199)}× ROI this month
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Benchmark + Activity — two column on desktop */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Benchmark */}
        <div className="rounded-lg border border-border p-5 space-y-3">
          <p className="text-sm font-semibold">Activity Benchmark</p>
          {data.weeklyHoursSaved === 0 ? (
            <p className="text-sm text-muted-foreground">
              Start generating briefs and rate checks to see how your activity compares.
            </p>
          ) : (
            <>
              <div className="rounded-md bg-muted/50 px-4 py-3">
                <p className="text-sm font-medium">
                  You checked rates{" "}
                  <span className="text-primary font-bold">{benchmarkLabel}</span>{" "}
                  this week
                </p>
                {benchmarkPct > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {benchmarkPct}% more than the typical broker on LaneBrief — staying ahead of the market.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded border border-border px-3 py-2">
                  <p className="text-muted-foreground">Your rate checks (7d)</p>
                  <p className="text-lg font-bold mt-0.5">{data.snapshotCount > 7 ? "7+" : data.snapshotCount}</p>
                </div>
                <div className="rounded border border-border px-3 py-2">
                  <p className="text-muted-foreground">Briefs generated (30d)</p>
                  <p className="text-lg font-bold mt-0.5">{data.briefsGenerated}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Activity feed */}
        <div className="rounded-lg border border-border p-5 space-y-3">
          <p className="text-sm font-semibold">Recent Activity</p>
          {data.activityFeed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activity yet. Generate a brief or rate check to see your feed.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.activityFeed.map((event, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3"
                >
                  <ActivityIcon type={event.type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{event.label}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {event.detail}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">
                    {fmtTime(event.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground print:text-gray-500">
        ROI estimates are based on AI-generated rate data and industry labor benchmarks ($50/hr). Not a substitute for financial analysis.
      </p>
    </div>
  );
}
