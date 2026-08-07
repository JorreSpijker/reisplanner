import maplibregl from "maplibre-gl";
import { FileSource, PMTiles, Protocol } from "pmtiles";
import { layers, namedTheme } from "protomaps-themes-base";
import type { StyleSpecification } from "maplibre-gl";

/** Gratis vectorstijl van CARTO; alleen bruikbaar mét internet. */
export const ONLINE_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const PROTOCOL = "pmtiles";
const SLEUTEL = "kaart.pmtiles";

let protocol: Protocol | null = null;

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
    layers: layers("protomaps", namedTheme("light"), { lang: "nl" }),
  };
}
