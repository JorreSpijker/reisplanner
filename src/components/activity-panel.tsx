"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/session";
import { useFavorites, useTripStore } from "@/lib/store";
import type { Activity } from "@/lib/types";
import { MapPinIcon } from "./map-pin-icon";
import { PlaceSearch } from "./place-search";
import { RichText } from "./rich-text";

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
          className="shrink-0 rounded-sm px-2 py-1 text-sm text-text-subtle hover:text-text"
        >
          ×
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <ActivityLocationBlock activity={activity} />

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
      className={`flex shrink-0 items-center gap-2 self-start rounded-md border px-3 py-2 text-sm transition-colors ${
        kiest
          ? "border-danger bg-surface-raised font-medium"
          : "border-border-strong hover:bg-surface-sunken"
      }`}
    >
      <MapPinIcon />
      {kiest ? "Annuleren" : location ? "Verplaats op kaart" : "Kies op kaart"}
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
    <div className="flex flex-col gap-1.5">
      <h3 className="text-sm font-medium">Locatie</h3>
      <div className="flex flex-col items-start gap-2 rounded-md border border-border px-3 py-2">
        <div>
          <p className="text-sm">{location.name}</p>
          <p className="font-mono text-xs text-text-subtle">
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {kiesKnop}

          {/* Coördinaten en niet de naam: die wijst Google altijd op de plek
              aan die hier op de kaart staat. */}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-2 self-start rounded-md border border-border-strong px-3 py-2 text-sm transition-colors hover:bg-surface-sunken"
          >
            <MapPinIcon />
            Open in Google Maps
          </a>

          <button
            type="button"
            onClick={handleFavoriet}
            disabled={alFavoriet}
            className="flex shrink-0 items-center gap-2 self-start rounded-md border border-border-strong px-3 py-2 text-sm transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
          >
            {alFavoriet ? "Staat in favorieten" : "Favoriet maken"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => user && saveActivity(user.id, { ...activity, location: null })}
          className="rounded-sm text-xs text-text-subtle hover:text-danger"
        >
          Locatie verwijderen
        </button>
      </div>
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
