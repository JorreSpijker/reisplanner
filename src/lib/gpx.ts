import type { MultiLineString } from "geojson";
import type { GpxFile } from "@/lib/types";

/**
 * GPX-bestanden die aan een dagdeel hangen: inlezen om te tekenen, en delen
 * met een kaart-app.
 *
 * Het bestand gaat als tekst mee in de reisdata en dus ook in de export. Een
 * ruwe tracklog van een hele dag is zo een paar megabyte groot; daarom een
 * grens, want de export is zonder server de enige back-up en moet te versturen
 * blijven.
 */
export const MAX_GPX_BYTES = 5 * 1024 * 1024;

/**
 * Punten uit één track- of routedeel, als [lng, lat]. Zoeken op naamruimte `*`:
 * het ene programma schrijft `<trkpt>`, het andere `<gpx:trkpt>`, en beide zijn
 * geldige GPX.
 */
function punten(parent: Element, tag: string): [number, number][] {
  return [...parent.getElementsByTagNameNS("*", tag)]
    .map<[number, number]>((punt) => [
      Number(punt.getAttribute("lon")),
      Number(punt.getAttribute("lat")),
    ])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
}

/**
 * Leest de lijnen uit een GPX-bestand: eerst de tracks, en anders de routes.
 * Losse waypoints leveren geen lijn op; een bestand met alleen die punten geeft
 * dus null, net als een bestand dat geen geldige XML is.
 */
export function parseGpx(xml: string): MultiLineString | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return null;

  const lijnen = [
    ...[...doc.getElementsByTagNameNS("*", "trkseg")].map((deel) =>
      punten(deel, "trkpt"),
    ),
    ...[...doc.getElementsByTagNameNS("*", "rte")].map((deel) =>
      punten(deel, "rtept"),
    ),
  ].filter((lijn) => lijn.length > 1);

  return lijnen.length === 0 ? null : { type: "MultiLineString", coordinates: lijnen };
}

/**
 * Ontleedt hetzelfde bestand niet bij elke render opnieuw: de kaart tekent de
 * track op elke muisbeweging, en een tracklog van tienduizend punten ontleden
 * is daar te duur voor.
 */
const ontleed = new Map<string, MultiLineString | null>();

export function gpxTrack(activityId: string, gpx: GpxFile): MultiLineString | null {
  const sleutel = `${activityId}:${gpx.xml.length}`;
  if (!ontleed.has(sleutel)) ontleed.set(sleutel, parseGpx(gpx.xml));
  return ontleed.get(sleutel) ?? null;
}

export type DeelResultaat = "gedeeld" | "afgebroken" | "gedownload";

/**
 * Geeft het bestand aan een kaart-app. Organic Maps opent GPX vanuit het
 * deelmenu van het toestel; een URL-schema waarmee je een bestand meegeeft
 * bestaat niet. Kan het toestel geen bestanden delen — meestal desktop — dan
 * blijft downloaden over, waarna de gebruiker het zelf opent.
 */
export async function deelGpx(gpx: GpxFile): Promise<DeelResultaat> {
  const bestand = new File([gpx.xml], gpx.name, { type: "application/gpx+xml" });

  if (navigator.canShare?.({ files: [bestand] })) {
    try {
      await navigator.share({ files: [bestand], title: gpx.name });
      return "gedeeld";
    } catch (cause) {
      // Zelf weggeklikt: dan niet alsnog ongevraagd downloaden.
      if ((cause as DOMException).name === "AbortError") return "afgebroken";
    }
  }

  const url = URL.createObjectURL(bestand);
  const link = document.createElement("a");
  link.href = url;
  link.download = gpx.name;
  link.click();
  URL.revokeObjectURL(url);
  return "gedownload";
}

export function formatteerBestandsgrootte(bytes: number): string {
  const kb = bytes / 1024;
  return kb < 1024
    ? `${Math.max(1, Math.round(kb))} kB`
    : `${(kb / 1024).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} MB`;
}
