// Border Delay Predictor — US-MX crossing delay risk
// Uses CBP WAIT API (public, no auth) with pattern-based fallback
// CBP BWT API: https://bwt.cbp.gov/api/bwtwaittimes

export type DelayRisk = "high" | "moderate" | "normal";

export type BorderDelayResult = {
  riskLevel: DelayRisk;
  crossingPoint: string | null;
  waitMinutes: number | null;
  patternNote: string | null;
  tariffCategoryFlag: boolean;
};

// US-MX crossings: keyword → CBP port mapping
// Port codes from CBP Border Wait Time system
const US_MX_CROSSINGS = [
  { keywords: ["laredo", "nuevo laredo"],                               portName: "Laredo, TX",     portCode: "2304" },
  { keywords: ["el paso", "ciudad juarez", "ciudad juárez", "juarez"],  portName: "El Paso, TX",    portCode: "2402" },
  { keywords: ["pharr", "mcallen", "reynosa"],                          portName: "Pharr, TX",       portCode: "2309" },
  { keywords: ["eagle pass", "piedras negras"],                         portName: "Eagle Pass, TX", portCode: "2306" },
  { keywords: ["del rio", "ciudad acuna", "ciudad acuña"],              portName: "Del Rio, TX",    portCode: "2305" },
  { keywords: ["nogales"],                                              portName: "Nogales, AZ",    portCode: "2604" },
  { keywords: ["otay mesa", "tijuana"],                                 portName: "Otay Mesa, CA",  portCode: "2506" },
  { keywords: ["calexico", "mexicali"],                                 portName: "Calexico, CA",   portCode: "2501" },
] as const;

// Baseline commercial truck wait times (minutes) per port — sourced from CBP historical averages
const BASE_WAIT_MINUTES: Record<string, number> = {
  "2304": 75, // Laredo — highest volume US-MX crossing
  "2402": 60, // El Paso / Ciudad Juárez
  "2309": 55, // Pharr / McAllen / Reynosa
  "2306": 50, // Eagle Pass
  "2305": 45, // Del Rio
  "2604": 52, // Nogales — produce surge active April 2026
  "2506": 55, // Otay Mesa
  "2501": 35, // Calexico — lower volume
};

// Day-of-week multiplier: Mon/Fri worst, Wed best
// 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
const DOW_MULTIPLIER: Record<number, number> = {
  0: 0.75, // Sunday  — reduced commercial traffic
  1: 1.30, // Monday  — high (weekend backlog clears)
  2: 0.90, // Tuesday — slightly below average
  3: 0.80, // Wednesday — lowest
  4: 0.90, // Thursday — moderate
  5: 1.40, // Friday  — highest (end-of-week push)
  6: 0.75, // Saturday — low
};

const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Tariff-category goods that trigger elevated CBP inspection (steel, auto parts, electronics)
// Flatbed is a strong proxy for steel/auto parts loads
const HIGH_INSPECTION_KEYWORDS = ["steel", "auto", "aluminum", "electronic", "machinery", "vehicle", "flatbed"];

export function detectUSMXCrossing(lane: { origin: string; destination: string }) {
  const text = `${lane.origin} ${lane.destination}`.toLowerCase();
  for (const c of US_MX_CROSSINGS) {
    if (c.keywords.some((kw) => text.includes(kw))) {
      return { portName: c.portName, portCode: c.portCode };
    }
  }
  return null;
}

export function hasTariffCategoryRisk(lane: { equipment: string; origin: string; destination: string }): boolean {
  const text = `${lane.origin} ${lane.destination} ${lane.equipment}`.toLowerCase();
  return HIGH_INSPECTION_KEYWORDS.some((kw) => text.includes(kw));
}

function classifyRisk(waitMinutes: number, dow: number, tariffFlag: boolean): DelayRisk {
  const adjusted = waitMinutes * DOW_MULTIPLIER[dow];
  if (adjusted > 90 || (tariffFlag && adjusted > 60)) return "high";
  if (adjusted > 45) return "moderate";
  return "normal";
}

// Pattern-based scoring — used as primary source or CBP fallback
export function getPatternDelayResult(
  lane: { origin: string; destination: string; equipment: string },
): BorderDelayResult {
  const crossing = detectUSMXCrossing(lane);
  if (!crossing) {
    return { riskLevel: "normal", crossingPoint: null, waitMinutes: null, patternNote: null, tariffCategoryFlag: false };
  }

  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();
  const tariffFlag = hasTariffCategoryRisk(lane);

  const base = BASE_WAIT_MINUTES[crossing.portCode] ?? 50;
  // Peak hours: morning rush (6-10am) and afternoon push (2-6pm ET)
  const hourMult = (hour >= 6 && hour <= 10) || (hour >= 14 && hour <= 18) ? 1.25 : 0.9;
  const adjustedWait = Math.round(base * DOW_MULTIPLIER[dow] * hourMult);
  const riskLevel = classifyRisk(adjustedWait, dow, tariffFlag);

  const dowLabel = DOW_NAMES[dow];
  const isBadDay = dow === 1 || dow === 5;
  const patternNote = tariffFlag
    ? `${dowLabel} + tariff-category cargo — elevated CBP inspection likely`
    : isBadDay
    ? `${dowLabel} — peak delay day at ${crossing.portName}`
    : `${dowLabel} pattern at ${crossing.portName}`;

  return { riskLevel, crossingPoint: crossing.portName, waitMinutes: adjustedWait, patternNote, tariffCategoryFlag: tariffFlag };
}

// Live CBP data scoring — called when CBP API returns a wait time for this port
export function getLiveDelayResult(
  waitMinutes: number,
  crossing: { portName: string; portCode: string },
  lane: { equipment: string; origin: string; destination: string },
): BorderDelayResult {
  const now = new Date();
  const dow = now.getDay();
  const tariffFlag = hasTariffCategoryRisk(lane);
  const riskLevel = classifyRisk(waitMinutes, dow, tariffFlag);
  const isBadDay = dow === 1 || dow === 5;
  const patternNote = tariffFlag
    ? `${waitMinutes}min live · tariff-category cargo — elevated CBP inspection`
    : `${waitMinutes}min live · ${isBadDay ? DOW_NAMES[dow] + " peak day" : "normal flow"}`;

  return { riskLevel, crossingPoint: crossing.portName, waitMinutes, patternNote, tariffCategoryFlag: tariffFlag };
}
