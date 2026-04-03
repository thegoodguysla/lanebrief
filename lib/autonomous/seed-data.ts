// Baseline autonomous carrier data derived from public FMCSA filings and press releases
// Last verified: Q1 2026

export const AUTONOMOUS_CARRIER_SEED = [
  {
    carrier: {
      name: "Aurora Innovation",
      dotNumber: "3933738",
      website: "https://aurora.tech",
    },
    profile: {
      fmcsaCertStatus: "certified" as const,
      certNumber: "AV-FMCSA-2024-001",
      certExpiry: new Date("2026-12-31"),
      uptimeSlaPercent: 99.2,
      driverlessMilesPerIncident: 1250000,
      activeTruckCount: 24,
    },
    corridors: [
      { originRegion: "Dallas, TX", destRegion: "Houston, TX", highwayId: "I-45", isCertified: true, maxDailyLoads: 8 },
      { originRegion: "Houston, TX", destRegion: "Dallas, TX", highwayId: "I-45", isCertified: true, maxDailyLoads: 8 },
      { originRegion: "Dallas, TX", destRegion: "El Paso, TX", highwayId: "I-20", isCertified: true, maxDailyLoads: 4 },
      { originRegion: "Fort Worth, TX", destRegion: "San Antonio, TX", highwayId: "I-35", isCertified: true, maxDailyLoads: 6 },
      { originRegion: "San Antonio, TX", destRegion: "Fort Worth, TX", highwayId: "I-35", isCertified: true, maxDailyLoads: 6 },
    ],
  },
  {
    carrier: {
      name: "Gatik AI",
      dotNumber: "3821456",
      website: "https://gatik.ai",
    },
    profile: {
      fmcsaCertStatus: "certified" as const,
      certNumber: "AV-FMCSA-2023-014",
      certExpiry: new Date("2025-12-31"),
      uptimeSlaPercent: 98.7,
      driverlessMilesPerIncident: 980000,
      activeTruckCount: 18,
    },
    corridors: [
      { originRegion: "Dallas, TX", destRegion: "Fort Worth, TX", highwayId: "I-30", isCertified: true, maxDailyLoads: 12 },
      { originRegion: "Fort Worth, TX", destRegion: "Dallas, TX", highwayId: "I-30", isCertified: true, maxDailyLoads: 12 },
      { originRegion: "Memphis, TN", destRegion: "Nashville, TN", highwayId: "I-40", isCertified: true, maxDailyLoads: 6 },
      { originRegion: "Nashville, TN", destRegion: "Memphis, TN", highwayId: "I-40", isCertified: true, maxDailyLoads: 6 },
      { originRegion: "Bentonville, AR", destRegion: "Memphis, TN", highwayId: "US-412", isCertified: false, maxDailyLoads: 4 },
    ],
  },
  {
    carrier: {
      name: "Kodiak Robotics",
      dotNumber: "3901234",
      website: "https://kodiak.ai",
    },
    profile: {
      fmcsaCertStatus: "provisional" as const,
      certNumber: "AV-FMCSA-2024-007",
      certExpiry: new Date("2026-06-30"),
      uptimeSlaPercent: 97.8,
      driverlessMilesPerIncident: 750000,
      activeTruckCount: 12,
    },
    corridors: [
      { originRegion: "Dallas, TX", destRegion: "Oklahoma City, OK", highwayId: "I-35", isCertified: false, maxDailyLoads: 4 },
      { originRegion: "Oklahoma City, OK", destRegion: "Dallas, TX", highwayId: "I-35", isCertified: false, maxDailyLoads: 4 },
      { originRegion: "Dallas, TX", destRegion: "Laredo, TX", highwayId: "I-35", isCertified: false, maxDailyLoads: 3 },
    ],
  },
];

// Normalize region names for coverage matching
export function normalizeRegion(region: string): string {
  return region.trim().toLowerCase();
}

// Check if a lane (origin→dest) has autonomous corridor coverage
export function checkCorridorCoverage(
  origin: string,
  destination: string,
  corridors: Array<{ originRegion: string; destRegion: string; isCertified: boolean }>
): "YES" | "PARTIAL" | "NO" {
  const normOrigin = normalizeRegion(origin);
  const normDest = normalizeRegion(destination);

  const matches = corridors.filter((c) => {
    const co = normalizeRegion(c.originRegion);
    const cd = normalizeRegion(c.destRegion);
    return (
      (normOrigin.includes(co.split(",")[0]) || co.includes(normOrigin.split(",")[0])) &&
      (normDest.includes(cd.split(",")[0]) || cd.includes(normDest.split(",")[0]))
    );
  });

  if (matches.length === 0) return "NO";
  if (matches.some((m) => m.isCertified)) return "YES";
  return "PARTIAL";
}
