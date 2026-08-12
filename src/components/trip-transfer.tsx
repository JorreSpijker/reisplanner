"use client";

import { useRef, useState } from "react";
import { useSession } from "@/lib/auth/session";
import { isSameTrip, mergeTrips, type MergeChange } from "@/lib/repository/merge";
import { useTripStore } from "@/lib/store";
import { fileName, parseFile, toFile } from "@/lib/transfer";
import type { TripData } from "@/lib/types";

const EXPORT_SLEUTEL = "reisplanner:laatsteExport";

function leesLaatsteExport(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(EXPORT_SLEUTEL);
}

/** Het tijdstip van de meest recente wijziging in de hele reis. */
function useLaatsteWijziging(): string | null {
  const data = useTripStore((state) => state.data);
  if (!data) return null;

  return [
    data.trip.updatedAt,
    ...data.days.map((day) => day.updatedAt),
    ...data.activities.map((activity) => activity.updatedAt),
  ].reduce((hoogste, kandidaat) => (kandidaat > hoogste ? kandidaat : hoogste), "");
}

type Voorstel = {
  binnengekomen: TripData;
  changes: MergeChange[];
  exportedAt: string;
};

/**
 * Overdracht tussen apparaten via een bestand. Zolang er geen server is, is dit
 * de enige manier om je planning op de telefoon te krijgen — en meteen je enige
 * back-up.
 */
export function TripTransfer() {
  const { user } = useSession();
  const exportTrip = useTripStore((state) => state.exportTrip);
  const importTrip = useTripStore((state) => state.importTrip);

  const invoer = useRef<HTMLInputElement>(null);
  const [voorstel, setVoorstel] = useState<Voorstel | null>(null);
  const [melding, setMelding] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [laatsteExport, setLaatsteExport] = useState(() => leesLaatsteExport());
  const laatsteWijziging = useLaatsteWijziging();

  // Zonder server is de export je enige back-up. Herinner eraan zodra er sinds
  // de vorige export iets is veranderd.
  const achterstand = Boolean(
    laatsteWijziging && (!laatsteExport || laatsteWijziging > laatsteExport),
  );

  async function handleExport() {
    if (!user) return;
    const data = await exportTrip(user.id);
    if (!data) return;

    const blob = new Blob([JSON.stringify(toFile(data), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName(data);
    link.click();
    URL.revokeObjectURL(url);

    const nu = new Date().toISOString();
    window.localStorage.setItem(EXPORT_SLEUTEL, nu);
    setLaatsteExport(nu);
    setMelding("Bestand opgeslagen. Bewaar het ook als back-up.");
  }

  async function handleBestand(event: React.ChangeEvent<HTMLInputElement>) {
    const bestand = event.target.files?.[0];
    // Zodat hetzelfde bestand nog eens kiezen opnieuw werkt.
    event.target.value = "";
    if (!bestand || !user) return;

    setMelding(null);
    setVoorstel(null);

    const gelezen = parseFile(await bestand.text());
    if (!gelezen.ok) {
      setMelding(gelezen.reden);
      return;
    }

    const eigen = await exportTrip(user.id);
    if (eigen && !isSameTrip(eigen, gelezen.file.data)) {
      setMelding(
        "Dit bestand hoort bij een andere reis. Er is nog geen ondersteuning voor meerdere reizen.",
      );
      return;
    }

    // Alvast samenvoegen om te laten zien wat er zou gebeuren; pas na
    // bevestigen wordt er geschreven.
    const basis: TripData = eigen ?? {
      trip: gelezen.file.data.trip,
      days: [],
      activities: [],
      favorites: [],
      routes: [],
    };
    const { changes } = mergeTrips(basis, gelezen.file.data);

    if (changes.length === 0) {
      setMelding("Dit bestand bevat niets nieuws.");
      return;
    }

    setVoorstel({
      binnengekomen: gelezen.file.data,
      changes,
      exportedAt: gelezen.file.exportedAt,
    });
  }

  async function bevestig() {
    if (!user || !voorstel) return;
    setBezig(true);
    const { changes } = await importTrip(user.id, voorstel.binnengekomen);
    setBezig(false);
    setVoorstel(null);
    setMelding(`${changes.length} wijziging${changes.length === 1 ? "" : "en"} overgenomen.`);
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-md border border-border-strong px-2 py-1 text-xs font-medium hover:bg-surface-sunken pointer-coarse:min-h-11 pointer-coarse:px-3"
        >
          Exporteren
        </button>
        <button
          type="button"
          onClick={() => invoer.current?.click()}
          className="rounded-md border border-border-strong px-2 py-1 text-xs font-medium hover:bg-surface-sunken pointer-coarse:min-h-11 pointer-coarse:px-3"
        >
          Importeren
        </button>
        <input
          ref={invoer}
          type="file"
          accept="application/json,.json"
          onChange={handleBestand}
          className="hidden"
        />
      </div>

      {melding && (
        <p role="status" className="text-xs text-text-muted">
          {melding}
        </p>
      )}

      {achterstand && !voorstel && (
        <p className="text-xs text-text-muted">
          {laatsteExport
            ? `Sinds ${new Date(laatsteExport).toLocaleDateString("nl-NL")} niet geëxporteerd, en er is daarna iets gewijzigd.`
            : "Nog niet geëxporteerd. Deze reis staat alleen in deze browser."}
        </p>
      )}

      {voorstel && (
        <div className="flex flex-col gap-2 rounded-md border border-border-strong bg-surface-raised p-3">
          <p className="text-xs text-text-muted">
            {voorstel.exportedAt
              ? `Bestand van ${new Date(voorstel.exportedAt).toLocaleString("nl-NL")}.`
              : "Bestand zonder datum."}{" "}
            Dit verandert er:
          </p>

          <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto text-xs">
            {voorstel.changes.map((change, index) => (
              <li key={index} className="flex gap-2">
                <span
                  className={
                    change.actie === "verwijderd" ? "text-danger" : "text-text-subtle"
                  }
                >
                  {change.actie}
                </span>
                <span className="text-text-subtle">{change.soort}</span>
                <span className="flex-1 truncate">{change.naam}</span>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={bevestig}
              disabled={bezig}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-50 pointer-coarse:min-h-11"
            >
              {bezig ? "Bezig…" : "Toepassen"}
            </button>
            <button
              type="button"
              onClick={() => setVoorstel(null)}
              className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium hover:bg-surface-sunken pointer-coarse:min-h-11"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
