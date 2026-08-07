import type { LineString } from "geojson";

export type RouteLeg = {
  /** Rijtijd in seconden; null als de route hemelsbreed geschat is. */
  duration: number | null;
  /** Afstand in meters. */
  distance: number;
};

export type DayRoute = {
  geometry: LineString;
  /** Eén leg per traject tussen twee opeenvolgende punten. */
  legs: RouteLeg[];
  /** True als OSRM niet bereikbaar was en er rechte lijnen getekend zijn. */
  fallback: boolean;
};

/**
 * Beschrijft precies voor welke punten een route gold. Verandert de volgorde of
 * verschuift een punt, dan verandert deze sleutel en is de bewaarde route niet
 * meer bruikbaar.
 */
export function routeKey(
  waypoints: { id: string; lat: number; lng: number }[],
): string {
  return waypoints.map((point) => `${point.id}:${point.lng},${point.lat}`).join("|");
}

const EARTH_RADIUS_M = 6_371_000;

/** Hemelsbrede afstand tussen twee punten, in meters. */
export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Rechte lijnen tussen de punten, voor als de routedienst niet reageert. */
export function straightLineRoute(
  points: { lat: number; lng: number }[],
): DayRoute {
  return {
    geometry: {
      type: "LineString",
      coordinates: points.map((point) => [point.lng, point.lat]),
    },
    legs: points.slice(1).map((point, index) => ({
      duration: null,
      distance: haversine(points[index], point),
    })),
    fallback: true,
  };
}

export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} km`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} u` : `${hours} u ${rest} min`;
}
