"use client";

import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/geocode";

/**
 * Zoeken naar een plek. Weet zelf niets van dagdelen: wie hem gebruikt bepaalt
 * wat er met de gekozen plek gebeurt — een nieuw dagdeel of een locatie bij een
 * bestaand dagdeel.
 */
export function PlaceSearch({
  label,
  placeholder,
  bias,
  onPick,
}: {
  label: string;
  placeholder: string;
  /**
   * Geeft het punt waar de resultaten omheen mogen liggen, meestal het
   * kaartmidden. Een functie en geen waarde: dat midden verschuift bij elk
   * pannen, en dat mag geen nieuwe zoekopdracht uitlokken.
   */
  bias?: () => { lat: number; lng: number } | undefined;
  onPick: (place: Place) => void;
}) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const biasRef = useRef(bias);

  // Bijhouden in een ref en niet in de afhankelijkheden van het zoekeffect:
  // de aanroeper geeft elke render een nieuwe functie mee.
  useEffect(() => {
    biasRef.current = bias;
  });

  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) return;

    const id = ++requestId.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const punt = biasRef.current?.();
        const rond = punt ? `&lat=${punt.lat}&lng=${punt.lng}` : "";
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(term)}${rond}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("zoeken mislukt");
        const { places } = (await response.json()) as { places: Place[] };
        // Alleen verwerken als dit nog het laatste verzoek is.
        if (id === requestId.current) {
          setPlaces(places);
          setError(null);
        }
      } catch {
        if (!controller.signal.aborted && id === requestId.current) {
          setPlaces([]);
          setError("Zoeken lukt nu niet. Probeer het zo nog eens.");
        }
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  function handleChange(value: string) {
    setQuery(value);
    // Onder de drempel meteen opruimen; dat hoort bij de invoer, niet bij een
    // effect.
    if (value.trim().length < 3) {
      requestId.current += 1;
      setPlaces([]);
      setError(null);
      setSearching(false);
    }
  }

  function handlePick(place: Place) {
    onPick(place);
    setQuery("");
    setPlaces([]);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{label}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={placeholder}
          className="rounded-md border border-border-strong px-3 py-2 text-base placeholder:text-text-subtle pointer-coarse:min-h-11"
        />
      </label>

      {searching && <p className="text-xs text-text-subtle">Zoeken…</p>}

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      {places.length > 0 && (
        <ul
          aria-label="Zoekresultaten"
          className="flex flex-col overflow-hidden rounded-md border border-border"
        >
          {places.map((place) => (
            <li key={place.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => handlePick(place)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-surface-sunken pointer-coarse:min-h-11"
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
