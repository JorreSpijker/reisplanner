"use client";

import { useEffect, useRef, useState } from "react";
import {
  bewaarKaart,
  formatteerGrootte,
  kaartBestand,
  verwijderKaart,
} from "@/lib/offline-map";

/**
 * Beheer van het offline kaartbestand. Het bestand maak je zelf met de
 * `pmtiles`-tool; zie docs/PLAN-OPSLAG.md voor het commando.
 */
export function OfflineMapPanel() {
  const invoer = useRef<HTMLInputElement>(null);
  const [grootte, setGrootte] = useState<number | null>(null);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);

  useEffect(() => {
    void kaartBestand().then((bestand) => setGrootte(bestand?.size ?? null));
  }, []);

  async function handleBestand(event: React.ChangeEvent<HTMLInputElement>) {
    const bestand = event.target.files?.[0];
    event.target.value = "";
    if (!bestand) return;

    if (!bestand.name.endsWith(".pmtiles")) {
      setMelding("Kies een .pmtiles-bestand.");
      return;
    }

    setBezig(true);
    setMelding(null);
    try {
      await bewaarKaart(bestand);
      setGrootte(bestand.size);
      setMelding("Kaart opgeslagen. Herlaad de pagina om hem te gebruiken.");
    } catch (cause) {
      console.error("Kaart opslaan mislukt", cause);
      setMelding("Opslaan mislukt. Mogelijk is er te weinig ruimte op het toestel.");
    } finally {
      setBezig(false);
    }
  }

  async function handleVerwijderen() {
    await verwijderKaart();
    setGrootte(null);
    setMelding("Kaart verwijderd. De app gebruikt weer de online tegels.");
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">
          {grootte === null
            ? "Offline kaart: geen"
            : `Offline kaart: ${formatteerGrootte(grootte)}`}
        </span>

        <button
          type="button"
          onClick={() => invoer.current?.click()}
          disabled={bezig}
          className="rounded-md border border-border-strong px-2 py-1 text-xs font-medium hover:bg-surface-sunken disabled:opacity-50"
        >
          {bezig ? "Bezig…" : grootte === null ? "Kaart laden" : "Vervangen"}
        </button>

        {grootte !== null && (
          <button
            type="button"
            onClick={handleVerwijderen}
            className="rounded-md border border-border-strong px-2 py-1 text-xs font-medium hover:bg-surface-sunken"
          >
            Verwijderen
          </button>
        )}

        <input
          ref={invoer}
          type="file"
          accept=".pmtiles"
          onChange={handleBestand}
          className="hidden"
        />
      </div>

      {melding && (
        <p role="status" className="text-xs text-text-muted">
          {melding}
        </p>
      )}
    </section>
  );
}
