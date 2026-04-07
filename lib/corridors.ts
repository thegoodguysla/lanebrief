/**
 * Top US freight corridors for programmatic SEO.
 * Generated from top 30 freight metros — all directional pairs (~870 corridors).
 */

export type Corridor = {
  origin: string;
  destination: string;
  slug: string;
};

// Top 30 US freight metros by volume
const TOP_METROS = [
  "Los Angeles, CA",
  "Chicago, IL",
  "Dallas, TX",
  "Houston, TX",
  "Atlanta, GA",
  "Newark, NJ",
  "Philadelphia, PA",
  "Miami, FL",
  "Memphis, TN",
  "Columbus, OH",
  "Louisville, KY",
  "Indianapolis, IN",
  "Kansas City, MO",
  "Charlotte, NC",
  "Nashville, TN",
  "St. Louis, MO",
  "Minneapolis, MN",
  "Seattle, WA",
  "Phoenix, AZ",
  "Denver, CO",
  "Detroit, MI",
  "Baltimore, MD",
  "Portland, OR",
  "Salt Lake City, UT",
  "Jacksonville, FL",
  "Tampa, FL",
  "Cincinnati, OH",
  "Cleveland, OH",
  "El Paso, TX",
  "Laredo, TX",
] as const;

function toSlug(city: string): string {
  return city
    .toLowerCase()
    .replace(/,\s*[a-z]{2}$/i, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Display name without state: "Los Angeles, CA" → "Los Angeles" */
export function cityName(full: string): string {
  return full.replace(/,\s*[A-Z]{2}$/, "").trim();
}

/** State abbreviation: "Los Angeles, CA" → "CA" */
export function cityState(full: string): string {
  return full.match(/,\s*([A-Z]{2})$/)?.[1] ?? "";
}

// Build all directional corridor pairs (O≠D)
const _corridors: Corridor[] = [];
for (const origin of TOP_METROS) {
  for (const destination of TOP_METROS) {
    if (origin === destination) continue;
    _corridors.push({
      origin,
      destination,
      slug: `${toSlug(origin)}-${toSlug(destination)}`,
    });
  }
}

export const CORRIDORS: readonly Corridor[] = _corridors;

/** Lookup map: slug → Corridor */
export const CORRIDOR_MAP: ReadonlyMap<string, Corridor> = new Map(
  _corridors.map((c) => [c.slug, c])
);

/** Return up to N related corridors for a given corridor (same origin or destination, different endpoint). */
export function relatedCorridors(corridor: Corridor, n = 5): Corridor[] {
  const sameOrigin = _corridors.filter(
    (c) =>
      c.origin === corridor.origin &&
      c.destination !== corridor.destination
  );
  const sameDest = _corridors.filter(
    (c) =>
      c.destination === corridor.destination &&
      c.origin !== corridor.origin
  );
  // Alternate between same-origin and same-dest for variety
  const results: Corridor[] = [];
  const maxEach = Math.ceil(n / 2);
  results.push(...sameOrigin.slice(0, maxEach));
  results.push(...sameDest.slice(0, n - results.length));
  return results.slice(0, n);
}
