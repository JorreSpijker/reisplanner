import { NextResponse } from "next/server";
import { toPlaces } from "@/lib/geocode";

const PHOTON_SEARCH = "https://photon.komoot.io/api/";

/**
 * Zoeken op plaatsnaam via Photon. Loopt bewust via de server: zodra er een
 * sessie is kan hier een check en een rate-limit per gebruiker bij, zonder de
 * componenten aan te passen.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Parameter q ontbreekt" }, { status: 400 });
  }

  const url = new URL(PHOTON_SEARCH);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "6");

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    return NextResponse.json(
      { error: "Zoekdienst niet bereikbaar" },
      { status: 502 },
    );
  }

  return NextResponse.json({ places: toPlaces(await response.json()) });
}
