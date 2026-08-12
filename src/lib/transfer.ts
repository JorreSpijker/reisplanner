import type { TripData } from "@/lib/types";

/**
 * Vorm van het uitwisselbestand. De versie staat erin zodat een bestand dat je
 * over een half jaar terugvindt nog te lezen is, ook als het model intussen is
 * gewijzigd.
 */
export const SCHEMA_VERSION = 3;

export type TripFile = {
  schemaVersion: number;
  exportedAt: string;
  data: TripData;
};

export function toFile(data: TripData): TripFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function fileName(data: TripData): string {
  const naam = data.trip.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `reisplanner-${naam || "reis"}-${new Date().toISOString().slice(0, 10)}.json`;
}

export type ParseResult =
  | { ok: true; file: TripFile }
  | { ok: false; reden: string };

/** Leest een geïmporteerd bestand en controleert of het bruikbaar is. */
export function parseFile(text: string): ParseResult {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return { ok: false, reden: "Dit is geen geldig JSON-bestand." };
  }

  const file = payload as Partial<TripFile>;
  if (typeof file?.schemaVersion !== "number" || !file.data) {
    return { ok: false, reden: "Dit lijkt geen export van de reisplanner." };
  }
  if (file.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      reden: `Dit bestand komt uit een nieuwere versie (${file.schemaVersion}). Werk de app eerst bij.`,
    };
  }

  const data = file.data;
  if (!data.trip?.id || !Array.isArray(data.days) || !Array.isArray(data.activities)) {
    return { ok: false, reden: "Het bestand mist gegevens die nodig zijn." };
  }

  return {
    ok: true,
    file: {
      schemaVersion: file.schemaVersion,
      exportedAt: file.exportedAt ?? "",
      data,
    },
  };
}
