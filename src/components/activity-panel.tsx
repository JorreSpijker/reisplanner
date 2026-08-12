"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth/session";
import {
  MAX_GPX_BYTES,
  deelGpx,
  formatteerBestandsgrootte,
  parseGpx,
} from "@/lib/gpx";
import { useFavorites, useTripStore } from "@/lib/store";
import type { Activity } from "@/lib/types";
import { ConfirmDialog } from "./confirm-dialog";
import { ExternalLinkIcon } from "./external-link-icon";
import { MapPinIcon } from "./map-pin-icon";
import { PencilIcon } from "./pencil-icon";
import { PlaceSearch } from "./place-search";
import { RichText } from "./rich-text";
import { StarIcon } from "./star-icon";
import { Tooltip } from "./tooltip";
import { TrashIcon } from "./trash-icon";

/** Een knop in een icoongroep: alleen het icoon, met de duim ook het woord. */
const KNOP_IN_GROEP =
  "flex items-center px-3 py-2 transition-colors pointer-coarse:min-h-11 pointer-coarse:flex-col pointer-coarse:justify-center pointer-coarse:gap-0.5 pointer-coarse:px-2.5";

const KNOPLABEL = "hidden text-xs leading-none pointer-coarse:block";

/**
 * Derde kolom: alles van het geopende dagdeel — titel, tijd, locatie en
 * notitie. Verschijnt pas zodra er een dagdeel gekozen is en verdwijnt weer met
 * de sluitknop.
 */
export function ActivityPanel({ activity }: { activity: Activity }) {
  const setSelectedActivity = useTripStore((state) => state.setSelectedActivity);
  const setMobileTab = useTripStore((state) => state.setMobileTab);
  const setHoveredActivity = useTripStore((state) => state.setHoveredActivity);

  function handleClose() {
    setSelectedActivity(null);
    setMobileTab("dag");
  }

  return (
    <section
      aria-label="Dagdeel"
      onMouseEnter={() => setHoveredActivity(activity.id)}
      onMouseLeave={() => setHoveredActivity(null)}
      className="flex w-full shrink-0 flex-col border-t border-border bg-surface lg:w-[360px] lg:border-l lg:border-t-0"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <ActivityTitle activity={activity} />
          <ActivityTime activity={activity} />
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Dagdeel sluiten"
          className="flex shrink-0 items-center justify-center rounded-sm px-2 py-1 text-sm text-text-subtle hover:text-text pointer-coarse:size-11"
        >
          ×
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <ActivityLocationBlock activity={activity} />

        <ActivityGpx activity={activity} />

        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium">Notitie</h3>
          <ActivityNote activity={activity} />
        </div>
      </div>
    </section>
  );
}

function ActivityTitle({ activity }: { activity: Activity }) {
  const { user } = useSession();
  const saveActivity = useTripStore((state) => state.saveActivity);
  const [title, setTitle] = useState(activity.title);

  useEffect(() => {
    const trimmed = title.trim();
    // Een lege titel niet opslaan: het dagdeel staat ook in de planning.
    if (trimmed.length === 0 || trimmed === activity.title) return;

    const timer = setTimeout(() => {
      if (user) void saveActivity(user.id, { ...activity, title: trimmed });
    }, 600);
    return () => clearTimeout(timer);
  }, [title, activity, user, saveActivity]);

  return (
    <input
      value={title}
      onChange={(event) => setTitle(event.target.value)}
      // Leeggemaakt en weggeklikt: terug naar de opgeslagen titel.
      onBlur={() => title.trim().length === 0 && setTitle(activity.title)}
      aria-label="Titel van het dagdeel"
      placeholder="Titel van het dagdeel"
      className="w-full rounded-sm font-display text-lg font-semibold placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-text-subtle"
    />
  );
}

function ActivityTime({ activity }: { activity: Activity }) {
  const { user } = useSession();
  const saveActivity = useTripStore((state) => state.saveActivity);
  const [time, setTime] = useState(activity.time);

  useEffect(() => {
    const trimmed = time.trim();
    if (trimmed === activity.time) return;

    const timer = setTimeout(() => {
      if (user) void saveActivity(user.id, { ...activity, time: trimmed });
    }, 600);
    return () => clearTimeout(timer);
  }, [time, activity, user, saveActivity]);

  return (
    <input
      value={time}
      onChange={(event) => setTime(event.target.value)}
      aria-label="Tijd"
      placeholder="09:00 - 11:00"
      className="w-full rounded-sm font-mono text-xs text-text-muted placeholder:font-sans placeholder:text-text-subtle"
    />
  );
}

function ActivityLocationBlock({ activity }: { activity: Activity }) {
  const { user } = useSession();
  const saveActivity = useTripStore((state) => state.saveActivity);
  const saveFavorite = useTripStore((state) => state.saveFavorite);
  const tripId = useTripStore((state) => state.data?.trip.id);
  const favorites = useFavorites();
  const mapPick = useTripStore((state) => state.mapPick);
  const setMapPick = useTripStore((state) => state.setMapPick);
  const setMobileTab = useTripStore((state) => state.setMobileTab);
  const [vraagtVerwijderen, setVraagtVerwijderen] = useState(false);
  const { location } = activity;

  // Dezelfde coördinaten betekent dezelfde plek; de naam mag afwijken.
  const alFavoriet = favorites.some(
    (favorite) => favorite.lat === location?.lat && favorite.lng === location?.lng,
  );

  function handleFavoriet() {
    if (!user || !tripId || !location) return;
    void saveFavorite(user.id, {
      id: crypto.randomUUID(),
      tripId,
      name: location.name,
      lat: location.lat,
      lng: location.lng,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    });
  }

  const modus = location ? ("verplaatsen" as const) : ("locatie" as const);
  const kiest = mapPick?.mode === modus && mapPick.activityId === activity.id;

  function handleKies() {
    if (kiest) {
      setMapPick(null);
      return;
    }
    setMapPick({ mode: modus, activityId: activity.id });
    // Op mobiel staat de kaart in een eigen tabblad; daar valt pas iets te kiezen.
    setMobileTab("kaart");
  }

  const kiesKnop = (
    <button
      type="button"
      onClick={handleKies}
      aria-pressed={kiest}
      className={`flex shrink-0 items-center gap-2 self-start rounded-md border px-3 py-2 text-sm transition-colors pointer-coarse:min-h-11 ${
        kiest
          ? "border-danger bg-surface-raised font-medium"
          : "border-border-strong hover:bg-surface-sunken"
      }`}
    >
      <MapPinIcon />
      {kiest ? "Annuleren" : "Kies op kaart"}
    </button>
  );

  if (!location) {
    return (
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <PlaceSearch
            label="Locatie"
            placeholder="Zoek een plek"
            onPick={(place) => {
              if (!user) return;
              void saveActivity(user.id, {
                ...activity,
                location: { name: place.name, lat: place.lat, lng: place.lng },
              });
            }}
          />
        </div>
        {kiesKnop}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Locatie</h3>
      <div>
        <p className="text-sm">{location.name}</p>
        <p className="font-mono text-xs text-text-subtle">
          {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
        </p>
      </div>

      {/* Eén groep: alles wat je met deze plek kunt doen, in volgorde van hoe
          vaak je het doet. Verwijderen staat apart, achteraan.

          Op een aanraakscherm staat het woord onder het icoon: de tooltip
          hangt aan hover en die bestaat daar niet, dus zou er alleen een
          plaatje overblijven. */}
      <div className="flex w-fit items-stretch divide-x divide-border-strong rounded-md border border-border-strong">
        <Tooltip label={kiest ? "Annuleren" : "Verplaats op kaart"}>
          <button
            type="button"
            onClick={handleKies}
            aria-pressed={kiest}
            aria-label={kiest ? "Verplaatsen annuleren" : "Verplaats op kaart"}
            className={`${KNOP_IN_GROEP} rounded-l-md ${
              kiest ? "bg-primary text-on-primary" : "hover:bg-surface-sunken"
            }`}
          >
            <MapPinIcon />
            <span className={KNOPLABEL}>{kiest ? "Annuleren" : "Verplaats"}</span>
          </button>
        </Tooltip>

        {/* Coördinaten en niet de naam: die wijst Google altijd op de plek
            aan die hier op de kaart staat. */}
        <Tooltip label="Open in Google Maps">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open in Google Maps"
            className={`${KNOP_IN_GROEP} hover:bg-surface-sunken`}
          >
            <ExternalLinkIcon />
            <span className={KNOPLABEL}>Maps</span>
          </a>
        </Tooltip>

        <Tooltip label={alFavoriet ? "Staat al in favorieten" : "Favoriet maken"}>
          <button
            type="button"
            onClick={handleFavoriet}
            disabled={alFavoriet}
            aria-label={alFavoriet ? "Staat al in favorieten" : "Favoriet maken"}
            // Zonder pointer-events-none slikt de uitgezette knop de hover op
            // en blijft de tooltip weg.
            className={`${KNOP_IN_GROEP} hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-50`}
          >
            <StarIcon filled={alFavoriet} />
            <span className={KNOPLABEL}>Favoriet</span>
          </button>
        </Tooltip>

        <Tooltip label="Locatie verwijderen">
          <button
            type="button"
            onClick={() => setVraagtVerwijderen(true)}
            aria-label="Locatie verwijderen"
            className={`${KNOP_IN_GROEP} rounded-r-md text-text-subtle hover:bg-surface-sunken hover:text-danger`}
          >
            <TrashIcon />
            <span className={KNOPLABEL}>Wissen</span>
          </button>
        </Tooltip>
      </div>

      {vraagtVerwijderen && (
        <ConfirmDialog
          title="Locatie verwijderen?"
          description={`${location.name} verdwijnt van de kaart en uit de route van deze dag. Het dagdeel zelf blijft staan.`}
          confirmLabel="Verwijderen"
          onCancel={() => setVraagtVerwijderen(false)}
          onConfirm={() => {
            setVraagtVerwijderen(false);
            if (user) void saveActivity(user.id, { ...activity, location: null });
          }}
        />
      )}
    </div>
  );
}

/**
 * De GPX-track bij dit dagdeel: de wandeling of rit zelf. Hij komt groen op de
 * kaart te staan en gaat met "Openen in Organic Maps" naar een kaart-app die
 * hem offline kan navigeren.
 */
function ActivityGpx({ activity }: { activity: Activity }) {
  const { user } = useSession();
  const saveActivity = useTripStore((state) => state.saveActivity);
  const invoer = useRef<HTMLInputElement>(null);
  const [melding, setMelding] = useState<string | null>(null);
  const { gpx } = activity;

  async function handleBestand(event: React.ChangeEvent<HTMLInputElement>) {
    const bestand = event.target.files?.[0];
    // Zodat hetzelfde bestand nog eens kiezen opnieuw werkt.
    event.target.value = "";
    if (!bestand || !user) return;

    setMelding(null);

    if (bestand.size > MAX_GPX_BYTES) {
      setMelding(
        `Dit bestand is ${formatteerBestandsgrootte(bestand.size)}; ${formatteerBestandsgrootte(MAX_GPX_BYTES)} is het maximum. Dun de track eerst uit.`,
      );
      return;
    }

    const xml = await bestand.text();
    if (!parseGpx(xml)) {
      setMelding("In dit bestand staat geen track of route.");
      return;
    }

    await saveActivity(user.id, {
      ...activity,
      gpx: { name: bestand.name, xml },
    });
  }

  async function handleOpenen() {
    if (!gpx) return;
    const resultaat = await deelGpx(gpx);
    setMelding(
      resultaat === "gedownload"
        ? "Bestand gedownload. Open het met Organic Maps."
        : null,
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Track (GPX)</h3>

      {gpx ? (
        <>
          <div>
            <p className="truncate text-sm">{gpx.name}</p>
            <p className="font-mono text-xs text-text-subtle">
              {formatteerBestandsgrootte(new Blob([gpx.xml]).size)}
            </p>
          </div>

          <div className="flex w-fit items-stretch divide-x divide-border-strong rounded-md border border-border-strong">
            <button
              type="button"
              onClick={handleOpenen}
              className="rounded-l-md px-3 py-2 text-sm transition-colors hover:bg-surface-sunken pointer-coarse:min-h-11"
            >
              Openen in Organic Maps
            </button>

            <Tooltip label="Vervangen">
              <button
                type="button"
                onClick={() => invoer.current?.click()}
                aria-label="Track vervangen"
                className={`${KNOP_IN_GROEP} text-text-subtle hover:bg-surface-sunken hover:text-text`}
              >
                <PencilIcon />
                <span className={KNOPLABEL}>Vervang</span>
              </button>
            </Tooltip>

            <Tooltip label="Track verwijderen">
              <button
                type="button"
                onClick={() =>
                  user && void saveActivity(user.id, { ...activity, gpx: null })
                }
                aria-label="Track verwijderen"
                className={`${KNOP_IN_GROEP} rounded-r-md text-text-subtle hover:bg-surface-sunken hover:text-danger`}
              >
                <TrashIcon />
                <span className={KNOPLABEL}>Wissen</span>
              </button>
            </Tooltip>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => invoer.current?.click()}
          className="w-fit rounded-md border border-border-strong px-3 py-2 text-sm transition-colors hover:bg-surface-sunken pointer-coarse:min-h-11"
        >
          GPX toevoegen
        </button>
      )}

      <input
        ref={invoer}
        type="file"
        accept=".gpx,application/gpx+xml"
        onChange={handleBestand}
        className="hidden"
      />

      {melding && (
        <p role="status" className="text-xs text-text-muted">
          {melding}
        </p>
      )}
    </div>
  );
}

function ActivityNote({ activity }: { activity: Activity }) {
  const { user } = useSession();
  const saveActivity = useTripStore((state) => state.saveActivity);
  const [html, setHtml] = useState(activity.notes);

  useEffect(() => {
    if (html === activity.notes) return;

    const timer = setTimeout(() => {
      if (user) void saveActivity(user.id, { ...activity, notes: html });
    }, 600);
    return () => clearTimeout(timer);
  }, [html, activity, user, saveActivity]);

  return <RichText value={activity.notes} onChange={setHtml} />;
}
