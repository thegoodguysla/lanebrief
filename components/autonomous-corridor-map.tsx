"use client";

import { useEffect, useState } from "react";

// Sun Belt city nodes — pixel coords on a 600×320 viewport centered on the region
const CITIES: Record<string, { x: number; y: number; label: string }> = {
  "Dallas, TX":        { x: 295, y: 185, label: "Dallas" },
  "Houston, TX":       { x: 320, y: 230, label: "Houston" },
  "Fort Worth, TX":    { x: 275, y: 180, label: "Ft Worth" },
  "El Paso, TX":       { x: 145, y: 195, label: "El Paso" },
  "San Antonio, TX":   { x: 270, y: 235, label: "San Antonio" },
  "Laredo, TX":        { x: 258, y: 258, label: "Laredo" },
  "Oklahoma City, OK": { x: 300, y: 148, label: "OKC" },
  "Memphis, TN":       { x: 400, y: 155, label: "Memphis" },
  "Nashville, TN":     { x: 430, y: 132, label: "Nashville" },
  "Bentonville, AR":   { x: 352, y: 148, label: "Bentonville" },
};

const CARRIER_COLORS: Record<string, { certified: string; provisional: string }> = {
  "Aurora Innovation": { certified: "#10b981", provisional: "#f59e0b" },
  "Gatik AI":          { certified: "#3b82f6", provisional: "#f59e0b" },
  "Kodiak Robotics":   { certified: "#10b981", provisional: "#f59e0b" },
};

const DEFAULT_CERTIFIED_COLOR = "#10b981";
const DEFAULT_PROVISIONAL_COLOR = "#f59e0b";
const NO_COVERAGE_COLOR = "#d1d5db";

type Corridor = {
  id: string;
  carrierId: string;
  originRegion: string;
  destRegion: string;
  highwayId: string | null;
  isCertified: boolean;
  maxDailyLoads: number | null;
  carrier: {
    id: string;
    name: string;
    fmcsaCertStatus: string | null;
  } | null;
};

type CarrierInfo = {
  id: string;
  name: string;
  fmcsaCertStatus: string | null;
};

interface AutonomousCorridorMapProps {
  className?: string;
}

export function AutonomousCorridorMap({ className }: AutonomousCorridorMapProps) {
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [allCarriers, setAllCarriers] = useState<CarrierInfo[]>([]);
  const [activeCarriers, setActiveCarriers] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<{ corridor: Corridor; x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/corridors/autonomous-coverage-map")
      .then((r) => r.json())
      .then((data) => {
        setCorridors(data.corridors ?? []);
        const carriers: CarrierInfo[] = data.carriers ?? [];
        setAllCarriers(carriers);
        setActiveCarriers(new Set(carriers.map((c: CarrierInfo) => c.name)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggleCarrier(name: string) {
    setActiveCarriers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  const visibleCorridors = corridors.filter(
    (c) => c.carrier && activeCarriers.has(c.carrier.name)
  );

  // Deduplicate bidirectional corridors for rendering (keep one per unordered pair)
  const renderedCorridors = visibleCorridors.filter((c, idx, arr) => {
    if (!CITIES[c.originRegion] || !CITIES[c.destRegion]) return false;
    const earlier = arr.findIndex(
      (x) => x.originRegion === c.destRegion && x.destRegion === c.originRegion && x.carrierId === c.carrierId
    );
    return earlier === -1 || earlier > idx;
  });

  function getColor(corridor: Corridor): string {
    const carrierName = corridor.carrier?.name ?? "";
    const colors = CARRIER_COLORS[carrierName] ?? {
      certified: DEFAULT_CERTIFIED_COLOR,
      provisional: DEFAULT_PROVISIONAL_COLOR,
    };
    return corridor.isCertified ? colors.certified : colors.provisional;
  }

  return (
    <div className={className}>
      {/* Carrier filter toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {allCarriers.map((carrier) => {
          const active = activeCarriers.has(carrier.name);
          const colors = CARRIER_COLORS[carrier.name] ?? { certified: DEFAULT_CERTIFIED_COLOR, provisional: DEFAULT_PROVISIONAL_COLOR };
          return (
            <button
              key={carrier.id}
              type="button"
              onClick={() => toggleCarrier(carrier.name)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-transparent text-white"
                  : "border-border bg-background text-muted-foreground opacity-50"
              }`}
              style={active ? { backgroundColor: colors.certified } : undefined}
            >
              {carrier.name}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-6 rounded-full" style={{ background: DEFAULT_CERTIFIED_COLOR }} />
            Certified
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-6 rounded-full" style={{ background: DEFAULT_PROVISIONAL_COLOR }} />
            Provisional
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-6 rounded-full" style={{ background: NO_COVERAGE_COLOR }} />
            No coverage
          </span>
        </div>
      </div>

      {/* SVG map */}
      <div className="relative rounded-lg border border-border bg-slate-50 dark:bg-slate-900 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
            <span className="text-sm text-muted-foreground animate-pulse">Loading corridors…</span>
          </div>
        )}

        <svg
          viewBox="0 0 600 320"
          className="w-full"
          style={{ maxHeight: 360 }}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Subtle state boundary outlines for Sun Belt context */}
          <rect x="130" y="120" width="220" height="150" rx="4" fill="none" stroke="#e2e8f0" strokeWidth="1" />
          <text x="138" y="133" fontSize="9" fill="#94a3b8">Texas</text>
          <rect x="350" y="120" width="120" height="80" rx="4" fill="none" stroke="#e2e8f0" strokeWidth="1" />
          <text x="358" y="133" fontSize="9" fill="#94a3b8">Mid-South</text>
          <rect x="270" y="100" width="90" height="55" rx="4" fill="none" stroke="#e2e8f0" strokeWidth="1" />
          <text x="278" y="113" fontSize="9" fill="#94a3b8">OK/AR</text>

          {/* Corridor lines */}
          {renderedCorridors.map((corridor) => {
            const from = CITIES[corridor.originRegion];
            const to = CITIES[corridor.destRegion];
            if (!from || !to) return null;
            const color = getColor(corridor);
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            return (
              <g key={`${corridor.id}-line`}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  opacity={0.85}
                />
                {/* Invisible wider hit area for hover */}
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="transparent"
                  strokeWidth={14}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => {
                    const svg = (e.target as SVGElement).closest("svg");
                    const rect = svg?.getBoundingClientRect();
                    if (!rect) return;
                    setHovered({ corridor, x: midX, y: midY });
                  }}
                />
                {/* Highway label */}
                {corridor.highwayId && (
                  <text
                    x={midX}
                    y={midY - 5}
                    fontSize="8"
                    fill={color}
                    textAnchor="middle"
                    opacity={0.9}
                  >
                    {corridor.highwayId}
                  </text>
                )}
              </g>
            );
          })}

          {/* City nodes */}
          {Object.entries(CITIES).map(([cityName, pos]) => {
            const hasCoverage = renderedCorridors.some(
              (c) => c.originRegion === cityName || c.destRegion === cityName
            );
            return (
              <g key={cityName}>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={5}
                  fill={hasCoverage ? "#1e293b" : "#94a3b8"}
                  stroke="white"
                  strokeWidth={1.5}
                />
                <text
                  x={pos.x}
                  y={pos.y - 9}
                  fontSize="9"
                  fill={hasCoverage ? "#1e293b" : "#94a3b8"}
                  textAnchor="middle"
                  fontWeight={hasCoverage ? "600" : "400"}
                >
                  {pos.label}
                </text>
              </g>
            );
          })}

          {/* Hover tooltip (SVG foreignObject for rich content) */}
          {hovered && (() => {
            const { corridor, x, y } = hovered;
            const tX = Math.min(x + 10, 490);
            const tY = Math.max(y - 60, 8);
            return (
              <foreignObject x={tX} y={tY} width={160} height={80}>
                <div
                  className="rounded-md border border-border bg-background/95 px-2.5 py-2 text-xs shadow-lg pointer-events-none"
                  // @ts-expect-error xmlns required for foreignObject
                  xmlns="http://www.w3.org/1999/xhtml"
                >
                  <p className="font-semibold text-foreground leading-tight">
                    {corridor.carrier?.name ?? "Unknown carrier"}
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    {corridor.originRegion} → {corridor.destRegion}
                  </p>
                  <p className="mt-0.5">
                    <span className={`font-medium ${corridor.isCertified ? "text-emerald-600" : "text-amber-600"}`}>
                      {corridor.isCertified ? "Certified" : "Provisional"}
                    </span>
                    {corridor.highwayId && <span className="text-muted-foreground"> · {corridor.highwayId}</span>}
                  </p>
                  {corridor.maxDailyLoads != null && (
                    <p className="text-muted-foreground">Up to {corridor.maxDailyLoads} loads/day</p>
                  )}
                </div>
              </foreignObject>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}
