"use client";

import { Badge } from "@/components/ui/badge";

interface AutonomousCoverageBadgeProps {
  coverage: "YES" | "NO" | "PARTIAL" | null | undefined;
  loading?: boolean;
}

export function AutonomousCoverageBadge({ coverage, loading }: AutonomousCoverageBadgeProps) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground animate-pulse">
        AV…
      </span>
    );
  }

  if (!coverage || coverage === "NO") {
    return (
      <span
        title="No autonomous carrier coverage on this lane"
        className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        AV: None
      </span>
    );
  }

  if (coverage === "PARTIAL") {
    return (
      <span
        title="Autonomous coverage available on part of this lane (provisional certification)"
        className="inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        AV: Partial
      </span>
    );
  }

  return (
    <span
      title="Full autonomous carrier coverage available on this lane"
      className="inline-flex items-center gap-1 rounded-full border border-emerald-400/60 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      AV: Covered
    </span>
  );
}
