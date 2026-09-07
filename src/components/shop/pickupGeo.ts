import type { PickupPointOption } from "@cms/storefront";

// ─────────────────────────────────────────────────────────────────────────────
// Pure geo helpers behind the pickup-point MAP pane (core DECISIONS 236).
//
// Everything here is client-side on purpose. The map pane already holds the
// whole country's catalog in memory (one request, see PickupPointMap), so
// "nearest to me" is a sort over an array we have — not a server round-trip and
// not a shopper's coordinates leaving the browser. Keeping these pure also makes
// them the only part of the map feature that is unit-testable: Leaflet itself
// needs real layout, which jsdom does not do.
// ─────────────────────────────────────────────────────────────────────────────

export interface LatLon {
  lat: number;
  lon: number;
}

/** A point that actually carries usable coordinates. */
export type LocatedPoint = PickupPointOption & LatLon;

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle distance in kilometres. Haversine is overkill-accurate for a
 * single country but costs nothing, and it stays correct if a catalog ever spans
 * the EU (the deferred multi-country case).
 */
export function distanceKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Keep only points we can actually plot. The feed currently geocodes every HR
 * point, but `lat`/`lon` are nullable on the wire, and a point without them must
 * silently stay a LIST-only result rather than land at (0, 0) off West Africa.
 */
export function locatedPoints(points: readonly PickupPointOption[]): LocatedPoint[] {
  return points.filter(
    (p): p is LocatedPoint =>
      typeof p.lat === "number" &&
      typeof p.lon === "number" &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lon)
  );
}

/**
 * Sort by distance from `origin`, nearest first. Unlocated points are dropped —
 * "nearest" is meaningless for them, and showing them at the end of a
 * distance-sorted list reads as "these are the farthest", which is a lie.
 */
export function sortByDistance(
  points: readonly PickupPointOption[],
  origin: LatLon
): Array<LocatedPoint & { distanceKm: number }> {
  return locatedPoints(points)
    .map((p) => ({ ...p, distanceKm: distanceKm(origin, p) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Short human distance: metres under a kilometre, one decimal under 10 km, whole
 * kilometres above. Locale-independent digits — the unit suffixes are the same
 * token in EN and HR, so this needs no translation.
 */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** Bounding box of a set of points, for the initial `fitBounds`. */
export function boundsOf(points: readonly LocatedPoint[]): [[number, number], [number, number]] | null {
  if (!points.length) return null;
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLon = points[0].lon;
  let maxLon = points[0].lon;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ];
}
