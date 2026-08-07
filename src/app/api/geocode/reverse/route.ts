import { NextResponse } from "next/server";
import { toPlaces } from "@/lib/geocode";

const PHOTON_REVERSE = "https://photon.komoot.io/reverse";

/** Naam zoeken bij coördinaten, voor het toevoegen van een stop via de kaart. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = params.get("lat");
  const lng = params.get("lng");
  if (!lat || !lng) {
    return NextResponse.json({ error: "lat en lng zijn verplicht" }, { status: 400 });
  }

  const url = new URL(PHOTON_REVERSE);
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lng);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    return NextResponse.json({ error: "Zoekdienst niet bereikbaar" }, { status: 502 });
  }

  return NextResponse.json({ place: toPlaces(await response.json())[0] ?? null });
}
