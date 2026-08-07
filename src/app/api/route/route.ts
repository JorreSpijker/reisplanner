import { NextResponse } from "next/server";
import type { LineString } from "geojson";
import { straightLineRoute, type DayRoute } from "@/lib/route";

/** Publieke demo-server van OSRM: gratis, zonder key, zonder uptime-garantie. */
const OSRM = "https://router.project-osrm.org/route/v1/driving/";

type OsrmResponse = {
  code: string;
  routes?: { geometry: LineString; legs: { duration: number; distance: number }[] }[];
};

/**
 * Route over de weg langs de stops van één dag.
 *
 * `coords` is een puntkomma-gescheiden reeks van `lng,lat`. Reageert de
 * demo-server niet, dan komen er rechte lijnen terug met `fallback: true`,
 * zodat de kaart altijd iets kan tekenen.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("coords");
  const points = (raw ?? "")
    .split(";")
    .filter(Boolean)
    .map((pair) => {
      const [lng, lat] = pair.split(",").map(Number);
      return { lng, lat };
    });

  if (points.length < 2 || points.some((p) => Number.isNaN(p.lat) || Number.isNaN(p.lng))) {
    return NextResponse.json(
      { error: "Geef minstens twee geldige punten als lng,lat;lng,lat" },
      { status: 400 },
    );
  }

  const url = `${OSRM}${points.map((p) => `${p.lng},${p.lat}`).join(";")}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`OSRM gaf status ${response.status}`);

    const payload = (await response.json()) as OsrmResponse;
    const route = payload.routes?.[0];
    if (payload.code !== "Ok" || !route) throw new Error(`OSRM gaf code ${payload.code}`);

    const result: DayRoute = {
      geometry: route.geometry,
      legs: route.legs.map((leg) => ({ duration: leg.duration, distance: leg.distance })),
      fallback: false,
    };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(straightLineRoute(points));
  }
}
