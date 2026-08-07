/** Zoekresultaat zoals de client het krijgt, losgekoppeld van het Photon-formaat. */
export type Place = {
  id: string;
  /** Korte naam voor in de stoplijst. */
  name: string;
  /** Naam plus plaats en land, om resultaten uit elkaar te houden. */
  label: string;
  lat: number;
  lng: number;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

function nameOf(properties: PhotonFeature["properties"]): string {
  if (properties.name) return properties.name;
  if (properties.street) {
    return [properties.street, properties.housenumber].filter(Boolean).join(" ");
  }
  return properties.city ?? properties.state ?? properties.country ?? "Naamloze plek";
}

/** Zet een Photon-FeatureCollection om naar `Place`s. */
export function toPlaces(payload: unknown): Place[] {
  const features = (payload as { features?: PhotonFeature[] }).features ?? [];

  return features.map((feature, index) => {
    const [lng, lat] = feature.geometry.coordinates;
    const { properties } = feature;
    const name = nameOf(properties);
    const context = [properties.city, properties.state, properties.country]
      .filter((part) => part && part !== name)
      .join(", ");

    return {
      id: `${properties.osm_type ?? "x"}${properties.osm_id ?? index}`,
      name,
      label: context ? `${name} — ${context}` : name,
      lat,
      lng,
    };
  });
}
