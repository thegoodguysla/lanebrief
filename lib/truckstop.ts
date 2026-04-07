/**
 * Truckstop Rate Insights API client
 *
 * Auth: Resource Owner Flow — exchange username/password for a Bearer token.
 * Env vars required:
 *   TRUCKSTOP_CLIENT_ID     — OAuth client id
 *   TRUCKSTOP_CLIENT_SECRET — OAuth client secret
 *   TRUCKSTOP_USERNAME      — Truckstop account username
 *   TRUCKSTOP_PASSWORD      — Truckstop account password
 *
 * Set TRUCKSTOP_SANDBOX=true to target api-int.truckstop.com instead of api.truckstop.com.
 */

const PROD_BASE = "https://api.truckstop.com";
const SANDBOX_BASE = "https://api-int.truckstop.com";

function base(): string {
  return process.env.TRUCKSTOP_SANDBOX === "true" ? SANDBOX_BASE : PROD_BASE;
}

// ── Equipment codes ──────────────────────────────────────────────────────────
const EQUIPMENT_CODE: Record<string, string> = {
  dry_van: "V",
  van: "V",
  reefer: "R",
  flatbed: "F",
  step_deck: "SD",
};

function equipmentCode(equipment: string): string {
  return EQUIPMENT_CODE[equipment.toLowerCase()] ?? "V";
}

// ── Token cache (module-level, survives warm lambda invocations) ──────────────
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const clientId = process.env.TRUCKSTOP_CLIENT_ID;
  const clientSecret = process.env.TRUCKSTOP_CLIENT_SECRET;
  const username = process.env.TRUCKSTOP_USERNAME;
  const password = process.env.TRUCKSTOP_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error("Truckstop credentials not configured");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${base()}/auth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "password",
      username,
      password,
      scope: "truckstop",
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Truckstop auth failed ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  // Expire 60 s before actual expiry to avoid edge-case races
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

// ── Location helper ───────────────────────────────────────────────────────────
type TruckstopLocation = {
  City: string;
  StateCode: string;
  ZipCode?: string;
};

/**
 * Parse a human-readable location string into a Truckstop location object.
 * Accepts formats like:
 *   "Atlanta, GA"          → { City: "Atlanta", StateCode: "GA" }
 *   "Atlanta, GA 30301"    → { City: "Atlanta", StateCode: "GA", ZipCode: "30301" }
 *   "30301"                → { ZipCode: "30301", City: "", StateCode: "" }
 */
export function parseLocation(input: string): TruckstopLocation {
  const trimmed = input.trim();

  // ZIP-only: 5 digits
  if (/^\d{5}$/.test(trimmed)) {
    return { City: "", StateCode: "", ZipCode: trimmed };
  }

  // "City, ST XXXXX" or "City, ST"
  const match = trimmed.match(/^(.+?),\s*([A-Z]{2})(?:\s+(\d{5}))?$/i);
  if (match) {
    return {
      City: match[1].trim(),
      StateCode: match[2].toUpperCase(),
      ...(match[3] ? { ZipCode: match[3] } : {}),
    };
  }

  // Fallback: treat as city with no state
  return { City: trimmed, StateCode: "" };
}

// ── Rate Insights requests ────────────────────────────────────────────────────

export type RateEstimateResult = {
  ratePerMile: number;
  ratePerTrip?: number;
  mileage?: number;
  lowerBound?: number;
  upperBound?: number;
  source: "truckstop_booked" | "truckstop_posted";
};

type RateEstimateResponse = {
  RatePerMile?: number;
  RatePerTrip?: number;
  Mileage?: number;
  LowerBound?: number;
  UpperBound?: number;
  // Some endpoints return camelCase
  ratePerMile?: number;
  ratePerTrip?: number;
  mileage?: number;
  lowerBound?: number;
  upperBound?: number;
};

async function callRateEstimate(
  endpoint: "booked" | "posted",
  origin: TruckstopLocation,
  destination: TruckstopLocation,
  equipment: string,
  mileage?: number
): Promise<RateEstimateResult> {
  const token = await getToken();

  const body: Record<string, unknown> = {
    Origin: origin,
    Destination: destination,
    TransportationMode: "TL",
    EquipmentCode: equipmentCode(equipment),
    ...(mileage ? { Mileage: mileage } : {}),
  };

  const url = `${base()}/modeledrate/v3/${endpoint}/rateestimate`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Truckstop ${endpoint} rate estimate failed ${res.status}: ${text}`);
  }

  const data = (await res.json()) as RateEstimateResponse;

  const ratePerMile = data.RatePerMile ?? data.ratePerMile ?? 0;
  return {
    ratePerMile,
    ratePerTrip: data.RatePerTrip ?? data.ratePerTrip,
    mileage: data.Mileage ?? data.mileage,
    lowerBound: data.LowerBound ?? data.lowerBound,
    upperBound: data.UpperBound ?? data.upperBound,
    source: endpoint === "booked" ? "truckstop_booked" : "truckstop_posted",
  };
}

/**
 * Get the booked rate estimate (what carriers were actually paid).
 * More stable / authoritative than posted rates.
 */
export async function getBookedRateEstimate(
  originStr: string,
  destinationStr: string,
  equipment: string
): Promise<RateEstimateResult> {
  return callRateEstimate(
    "booked",
    parseLocation(originStr),
    parseLocation(destinationStr),
    equipment
  );
}

/**
 * Get the posted rate estimate (initial advertised rate).
 * Faster/more available but represents negotiation starting point.
 */
export async function getPostedRateEstimate(
  originStr: string,
  destinationStr: string,
  equipment: string
): Promise<RateEstimateResult> {
  return callRateEstimate(
    "posted",
    parseLocation(originStr),
    parseLocation(destinationStr),
    equipment
  );
}

/**
 * Returns true if Truckstop credentials are configured in env.
 */
export function isTruckstopConfigured(): boolean {
  return !!(
    process.env.TRUCKSTOP_CLIENT_ID &&
    process.env.TRUCKSTOP_CLIENT_SECRET &&
    process.env.TRUCKSTOP_USERNAME &&
    process.env.TRUCKSTOP_PASSWORD
  );
}
