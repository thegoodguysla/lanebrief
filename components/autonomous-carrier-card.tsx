"use client";

import { useState } from "react";

export interface AutonomousCarrierData {
  id: string;
  name: string;
  dotNumber: string | null;
  website: string | null;
  fmcsaCertStatus: string | null;
  uptimeSlaPercent: number | null;
  driverlessMilesPerIncident: number | null;
  activeTruckCount: number | null;
}

interface AutonomousCarrierCardProps {
  carrier: AutonomousCarrierData;
  corridors?: Array<{
    originRegion: string;
    destRegion: string;
    highwayId: string | null;
    isCertified: boolean;
  }>;
}

function CertBadge({ status }: { status: string | null }) {
  if (status === "certified") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        FMCSA Certified
      </span>
    );
  }
  if (status === "provisional") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        FMCSA Provisional
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
      No Cert
    </span>
  );
}

const CERT_TOOLTIP = `FMCSA AV Certification means the carrier has received a federal exemption to operate autonomous vehicles commercially on approved highway segments. "Provisional" means conditional approval — typically under supervised operation with safety oversight.`;

const UPTIME_TOOLTIP = `Uptime SLA is the carrier's publicly committed system availability. For AV freight, this represents the percentage of scheduled loads the autonomous system can execute without human takeover.`;

const SAFETY_TOOLTIP = `Driverless miles per incident is a safety signal from public FMCSA safety reports. Higher is better — it means the system travels more miles between reportable incidents.`;

export function AutonomousCarrierCard({ carrier, corridors = [] }: AutonomousCarrierCardProps) {
  const [tooltip, setTooltip] = useState<string | null>(null);

  return (
    <div className="rounded-lg border-2 border-emerald-200 bg-background p-4 space-y-3 dark:border-emerald-900">
      {/* Header row with AV icon */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 text-sm font-bold dark:bg-emerald-950/40 dark:text-emerald-400"
            title="Autonomous Vehicle Carrier"
          >
            AV
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">{carrier.name}</p>
            {carrier.dotNumber && (
              <p className="text-xs text-muted-foreground">DOT #{carrier.dotNumber}</p>
            )}
          </div>
        </div>
        <CertBadge status={carrier.fmcsaCertStatus} />
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <button
          type="button"
          onClick={() => setTooltip(tooltip === "uptime" ? null : "uptime")}
          className="rounded-md border border-border p-2 hover:bg-muted/50 transition-colors text-left"
        >
          <p className="text-xs text-muted-foreground">Uptime SLA</p>
          <p className="text-sm font-semibold">
            {carrier.uptimeSlaPercent != null ? `${carrier.uptimeSlaPercent}%` : "—"}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setTooltip(tooltip === "safety" ? null : "safety")}
          className="rounded-md border border-border p-2 hover:bg-muted/50 transition-colors text-left"
        >
          <p className="text-xs text-muted-foreground">Mi/Incident</p>
          <p className="text-sm font-semibold">
            {carrier.driverlessMilesPerIncident != null
              ? `${(carrier.driverlessMilesPerIncident / 1_000_000).toFixed(1)}M`
              : "—"}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setTooltip(tooltip === "cert" ? null : "cert")}
          className="rounded-md border border-border p-2 hover:bg-muted/50 transition-colors text-left"
        >
          <p className="text-xs text-muted-foreground">Active Trucks</p>
          <p className="text-sm font-semibold">
            {carrier.activeTruckCount != null ? carrier.activeTruckCount : "—"}
          </p>
        </button>
      </div>

      {/* Tooltip explainer */}
      {tooltip && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground leading-relaxed">
          {tooltip === "uptime" && UPTIME_TOOLTIP}
          {tooltip === "safety" && SAFETY_TOOLTIP}
          {tooltip === "cert" && CERT_TOOLTIP}
        </p>
      )}

      {/* Active corridors */}
      {corridors.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Active Corridors
          </p>
          <ul className="space-y-0.5">
            {corridors.slice(0, 4).map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.isCertified ? "bg-emerald-500" : "bg-amber-400"}`} />
                {c.originRegion} → {c.destRegion}
                {c.highwayId && <span className="text-muted-foreground/60">({c.highwayId})</span>}
              </li>
            ))}
            {corridors.length > 4 && (
              <li className="text-xs text-muted-foreground/60">+{corridors.length - 4} more</li>
            )}
          </ul>
        </div>
      )}

      {carrier.website && (
        <a
          href={carrier.website}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-primary hover:underline"
        >
          Carrier profile →
        </a>
      )}
    </div>
  );
}
