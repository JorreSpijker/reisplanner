import maplibregl from "maplibre-gl";
import { FileSource, PMTiles, Protocol } from "pmtiles";
import { layers, namedTheme } from "protomaps-themes-base";
import type { StyleSpecification } from "maplibre-gl";

/**
 * Gratis vectorstijl van OpenFreeMap; alleen bruikbaar mét internet. Liberty
 * en niet CARTO Voyager: even kleurrijk, maar mét winkels, restaurants en
 * bezienswaardigheden vanaf zoom 15 — die tekent Voyager niet.
 */
export const ONLINE_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const PROTOCOL = "pmtiles";
const SLEUTEL = "kaart.pmtiles";

let protocol: Protocol | null = null;

/**
 * POI-soorten die het protomaps-thema standaard weglaat. De sprite in
 * `public/kaart/sprites/` heeft er wel een pictogram voor, en juist deze zoek
 * je onderweg: waar eet ik, waar koop ik water.
 */
const EXTRA_POIS = [
  "restaurant",
  "cafe",
  "bar",
  "fast_food",
  "supermarket",
  "convenience",
  "museum",
  "attraction",
  "artwork",
  "theatre",
  "post_office",
  "books",
  "clothes",
  "electronics",
  "beauty",
];

/**
 * Zet de extra soorten bij in de lijst waarop de POI-laag filtert. Het thema
 * bouwt die als `["in", ["get", "kind"], ["literal", [...]]]`; ziet het
 * filter er anders uit, dan blijft de laag zoals hij was — liever de kaart
 * zonder extra POIs dan een stijl die MapLibre weigert.
 */
function metExtraPois(filter: unknown): unknown {
  if (!Array.isArray(filter)) return filter;

  if (
    filter[0] === "literal" &&
    Array.isArray(filter[1]) &&
    filter[1].every((kind) => typeof kind === "string")
  ) {
    return ["literal", [...new Set([...filter[1], ...EXTRA_POIS])]];
  }

  return filter.map(metExtraPois);
}

/**
 * Bouwt een stijl die de tegels uit het opgeslagen bestand haalt. Lettertypen
 * en pictogrammen komen uit `public/kaart/`: die worden normaal van een CDN
 * gehaald, en dan zou de kaart offline zonder plaatsnamen staan.
 */
export function offlineStyle(bestand: File): StyleSpecification {
  if (!protocol) {
    protocol = new Protocol();
    maplibregl.addProtocol(PROTOCOL, protocol.tile);
  }

  // `FileSource` gebruikt de bestandsnaam als sleutel; die komt overeen met de
  // naam waaronder het in OPFS staat.
  const archief = new PMTiles(new FileSource(bestand));
  protocol.add(archief);

  return {
    version: 8,
    glyphs: "/kaart/fonts/{fontstack}/{range}.pbf",
    sprite: `${window.location.origin}/kaart/sprites/light`,
    sources: {
      protomaps: {
        type: "vector",
        url: `${PROTOCOL}://${SLEUTEL}`,
        attribution: "© OpenStreetMap, Protomaps",
      },
    },
    layers: layers("protomaps", namedTheme("light"), { lang: "nl" }).map((layer) =>
      layer.id === "pois" && "filter" in layer
        ? { ...layer, filter: metExtraPois(layer.filter) }
        : layer,
    ) as StyleSpecification["layers"],
  };
}
