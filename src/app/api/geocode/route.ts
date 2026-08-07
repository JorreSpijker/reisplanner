import { NextResponse } from "next/server";
import { toPlaces } from "@/lib/geocode";

const PHOTON_SEARCH = "https://photon.komoot.io/api/";

/**
 * Zoeken op plaatsnaam via Photon. Loopt bewust via de server: zodra er een
 * sessie is kan hier een check en een rate-limit per gebruiker bij, zonder de
 * componenten aan te passen.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Parameter q ontbreekt" }, { status: 400 });
  }

  const url = new URL(PHOTON_SEARCH);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "6");

  // Photon weegt resultaten dicht bij dit punt zwaarder. Zonder dat levert een
  // soort ("supermarkt", "museum") treffers uit heel Europa op.
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    return NextResponse.json(
      { error: "Zoekdienst niet bereikbaar" },
      { status: 502 },
    );
  }

  return NextResponse.json({ places: toPlaces(await response.json()) });
}
