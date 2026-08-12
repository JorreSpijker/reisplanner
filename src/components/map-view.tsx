"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useSession } from "@/lib/auth/session";
import { ONLINE_STYLE, offlineStyle } from "@/lib/map-style";
import { kaartBestand } from "@/lib/offline-map";
import type { Place } from "@/lib/geocode";
import {
  useActiveDayPlaces,
  useActiveDayStay,
  useActiveDayTracks,
  useTripStore,
} from "@/lib/store";
import { MapPinIcon } from "./map-pin-icon";
import { PlaceSearch } from "./place-search";

/** Naam bij coördinaten. Reageert de dienst niet, dan mag de gebruiker zelf. */
async function plaatsnaam(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
    if (response.ok) {
      const { place } = (await response.json()) as { place: Place | null };
      if (place) return place.name;
    }
  } catch {
    // Zonder naam uit de dienst blijft "Nieuwe plek" staan; de gebruiker kan
    // hem hernoemen.
  }
  return "Nieuwe plek";
}

/** Beginbeeld bij het openen van de kaart: West-Europa. Zodra een dag punten
 * heeft, richt de kaart daarop. */
const FALLBACK_VIEW = { longitude: 6.5, latitude: 48.5, zoom: 4 };

/**
 * Staat er een kaartbestand op het toestel, dan komen de tegels daaruit; anders
 * van CARTO. De keuze valt één keer bij het openen van de kaart.
 */
function useMapStyle(): StyleSpecification | string {
  const [style, setStyle] = useState<StyleSpecification | string>(ONLINE_STYLE);

  useEffect(() => {
    let afgebroken = false;

    void kaartBestand().then((bestand) => {
      if (bestand && !afgebroken) setStyle(offlineStyle(bestand));
    });

    return () => {
      afgebroken = true;
    };
  }, []);

  return style;
}

export function MapView() {
  const mapRef = useRef<MapRef>(null);
  const mapStyle = useMapStyle();
  // Het gekozen zoekresultaat. Blijft staan tot je iets anders zoekt of hem
  // wegklikt, zodat je erop kunt richten met "+ Favoriet".
  const [zoekPunt, setZoekPunt] = useState<Place | null>(null);
  const places = useActiveDayPlaces();
  const stay = useActiveDayStay();
  const tracks = useActiveDayTracks();
  const activeDayId = useTripStore((state) => state.activeDayId);
  const hoveredActivityId = useTripStore((state) => state.hoveredActivityId);
  const setHoveredActivity = useTripStore((state) => state.setHoveredActivity);
  const route = useTripStore((state) => state.route);
  const mapPick = useTripStore((state) => state.mapPick);
  const setMapPick = useTripStore((state) => state.setMapPick);
  const saveActivity = useTripStore((state) => state.saveActivity);
  const saveFavorite = useTripStore((state) => state.saveFavorite);
  const tripId = useTripStore((state) => state.data?.trip.id);
  const moveActivity = useTripStore((state) => state.moveActivity);
  const activities = useTripStore((state) => state.data?.activities);
  const selectedActivityId = useTripStore((state) => state.selectedActivityId);
  const setSelectedActivity = useTripStore((state) => state.setSelectedActivity);
  const setMobileTab = useTripStore((state) => state.setMobileTab);
  const mobileTab = useTripStore((state) => state.mobileTab);

  // Op mobiel start de kaart in een verborgen tabblad en heeft de container dan
  // geen hoogte. Bij het openen moet MapLibre opnieuw opmeten.
  useEffect(() => {
    if (mobileTab === "kaart") mapRef.current?.resize();
  }, [mobileTab]);

  /**
   * Bij het kiezen van een dag richt de kaart op de punten van die dag. Daarna
   * stuurt de gebruiker zelf: pas bij een volgende dag verspringt hij weer.
   * Staat de kaart in een verborgen tabblad, dan heeft de container geen
   * afmetingen; de sprong volgt zodra dat tabblad opengaat.
   */
  const gefitteDag = useRef<string | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || activeDayId === gefitteDag.current) return;
    if (map.getContainer().offsetParent === null) return;

    const punten: [number, number][] = places.map((place) => [
      place.location.lng,
      place.location.lat,
    ]);
    if (stay) punten.push([stay.lng, stay.lat]);
    // Een GPX-track loopt vaak verder dan het dagdeel waar hij aan hangt.
    for (const { track } of tracks) {
      for (const lijn of track.coordinates) {
        for (const [lng, lat] of lijn) punten.push([lng, lat]);
      }
    }
    if (punten.length === 0) return;

    gefitteDag.current = activeDayId;

    if (punten.length === 1) {
      map.easeTo({ center: punten[0], zoom: 13, duration: 800 });
      return;
    }

    // Met `reduce` en niet met `Math.min(...)`: een tracklog telt zomaar
    // tienduizenden punten, en zoveel argumenten slikt een aanroep niet.
    const grenzen = punten.reduce(
      (huidig, [lng, lat]) => [
        Math.min(huidig[0], lng),
        Math.min(huidig[1], lat),
        Math.max(huidig[2], lng),
        Math.max(huidig[3], lat),
      ],
      [180, 90, -180, -90],
    );

    map.fitBounds(
      [
        [grenzen[0], grenzen[1]],
        [grenzen[2], grenzen[3]],
      ],
      { padding: 60, maxZoom: 14, duration: 800 },
    );
  }, [activeDayId, places, stay, tracks, mobileTab]);

  /** Kiezen afbreken en terug naar het paneel waar het vandaan kwam. */
  const annuleerKeuze = useCallback(() => {
    if (!mapPick) return;
    setMapPick(null);
    setMobileTab(mapPick.mode === "favoriet" ? "dag" : "dagdeel");
  }, [mapPick, setMapPick, setMobileTab]);

  // Escape breekt het kiezen af.
  useEffect(() => {
    if (!mapPick) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") annuleerKeuze();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mapPick, annuleerKeuze]);
  const { user } = useSession();

  /**
   * Een klik telt alleen als de kaart in kiesmodus staat, gezet met de knop
   * "+ Favoriet" of de kiesknop in het dagdeelpaneel. Anders zou pannen en
   * zoomen ongemerkt punten aanwijzen.
   */
  async function handleClick(event: MapLayerMouseEvent) {
    if (!user || !mapPick) return;
    const { lng, lat } = event.lngLat;

    setMapPick(null);

    if (mapPick.mode === "verplaatsen") {
      await moveActivity(user.id, mapPick.activityId, lat, lng);
      setMobileTab("dagdeel");
      return;
    }

    const name = await plaatsnaam(lat, lng);

    if (mapPick.mode === "favoriet") {
      if (tripId) {
        await saveFavorite(user.id, {
          id: crypto.randomUUID(),
          tripId,
          name,
          lat,
          lng,
          updatedAt: new Date().toISOString(),
          deletedAt: null,
        });
      }
      setMobileTab("dag");
      return;
    }

    const activity = activities?.find((kandidaat) => kandidaat.id === mapPick.activityId);
    if (activity) {
      await saveActivity(user.id, { ...activity, location: { name, lat, lng } });
    }
    setMobileTab("dagdeel");
  }

  /**
   * Een klik op een pin zet dat dagdeel in het detailpaneel; op mobiel is dat
   * een eigen tabblad. Staat de kaart in kiesmodus, dan mag de pin de klik niet
   * opslokken: de gebruiker wijst dan een punt aan.
   */
  function handleMarkerClick(event: React.MouseEvent, activityId: string) {
    if (mapPick) return;
    event.stopPropagation();

    setSelectedActivity(activityId);
    setMobileTab("dagdeel");
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={FALLBACK_VIEW}
      mapStyle={mapStyle}
      style={{ width: "100%", height: "100%" }}
      onClick={handleClick}
      cursor={mapPick ? "crosshair" : undefined}
    >
      <NavigationControl position="top-right" showCompass={false} />

      {/* Logo en zoekbalk hangen samen aan de bovenrand van de kaart. */}
      <div className="absolute left-3 top-0 z-10 flex max-w-[calc(100%-1.5rem)] items-start gap-2">
        <div className="shrink-0 rounded-b-md border border-t-0 border-border bg-surface px-2 py-1.5 shadow-md">
          <Image
            src="/icon-512.png"
            alt="Reisplanner"
            width={512}
            height={512}
            priority
            className="size-9 rounded-sm"
          />
        </div>

        {/* Meegroeien tot 18rem en niet exact 18rem: naast het logo blijft er op
            een smalle telefoon anders te weinig over voor het invoerveld. */}
        <div className="w-full min-w-0 max-w-72 rounded-b-md border border-t-0 border-border bg-surface px-3 py-2 shadow-md">
          <PlaceSearch
            label="Zoek op de kaart"
            placeholder="Plaats, adres of “supermarkt”"
            bias={() => mapRef.current?.getCenter()}
            onPick={(place) => {
              setZoekPunt(place);
              mapRef.current?.easeTo({
                center: [place.lng, place.lat],
                zoom: 14,
                duration: 800,
              });
            }}
          />
        </div>
      </div>

      {/*
        Op mobiel staat de dagkolom in een ander tabblad, dus moet de kaart zelf
        vertellen dat hij op een klik wacht.
      */}
      {mapPick && (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex items-center gap-3 rounded-md border border-danger bg-surface px-3 py-2 text-xs text-text-muted shadow-md lg:inset-x-auto lg:bottom-auto lg:left-3 lg:top-28 lg:max-w-sm"
        >
          <span className="flex-1">
            {mapPick.mode === "verplaatsen"
              ? "Klik op de kaart om de nieuwe plek te kiezen."
              : mapPick.mode === "favoriet"
                ? "Klik op de kaart om de favoriet te plaatsen."
                : "Klik op de kaart om de plek te kiezen."}
          </span>
          <button
            type="button"
            onClick={annuleerKeuze}
            className="pointer-events-auto shrink-0 rounded-sm px-1 font-medium text-text hover:text-danger"
          >
            Annuleren
          </button>
        </div>
      )}

      {/* Onder de dagroute: die zwarte lijn is de planning, de track is wat je
          ter plekke loopt of fietst. */}
      {tracks.map(({ id, track }) => (
        <Source key={id} id={`gpx-${id}`} type="geojson" data={track}>
          <Layer
            id={`gpx-${id}-lijn`}
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": "#16a34a", "line-width": 3, "line-opacity": 0.9 }}
          />
        </Source>
      ))}

      {route && (
        <Source id="dag-route" type="geojson" data={route.geometry}>
          <Layer
            id="dag-route-lijn"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": "#111827",
              "line-width": 4,
              "line-opacity": 0.75,
              // Rechte lijnen zijn een schatting; die tonen we gestreept.
              ...(route.fallback ? { "line-dasharray": [2, 2] } : {}),
            }}
          />
        </Source>
      )}

      {zoekPunt && (
        <Marker longitude={zoekPunt.lng} latitude={zoekPunt.lat} anchor="bottom">
          <span className="flex max-w-56 items-center gap-1 rounded-full border-2 border-secondary bg-primary px-2 py-1 text-xs font-semibold text-on-primary shadow-md">
            <MapPinIcon className="size-3.5 shrink-0" />
            <span className="truncate">{zoekPunt.name}</span>
            <button
              type="button"
              onClick={() => setZoekPunt(null)}
              aria-label={`Zoekpunt ${zoekPunt.name} wissen`}
              className="shrink-0 rounded-sm px-0.5"
            >
              ×
            </button>
          </span>
        </Marker>
      )}

      {stay && (
        <Marker longitude={stay.lng} latitude={stay.lat} anchor="bottom">
          <span
            aria-label={`Verblijfplaats: ${stay.name}`}
            title={`Verblijfplaats: ${stay.name}`}
            className="flex size-7 items-center justify-center rounded-full border-2 border-secondary bg-surface text-text shadow-sm"
          >
            <MapPinIcon />
          </span>
        </Marker>
      )}

      {places.map((place, index) => (
        <Marker
          key={place.id}
          longitude={place.location.lng}
          latitude={place.location.lat}
          anchor="bottom"
        >
          <button
            type="button"
            onClick={(event) => handleMarkerClick(event, place.id)}
            onMouseEnter={() => setHoveredActivity(place.id)}
            onMouseLeave={() => setHoveredActivity(null)}
            onFocus={() => setHoveredActivity(place.id)}
            onBlur={() => setHoveredActivity(null)}
            aria-label={
              mapPick?.mode === "verplaatsen" && mapPick.activityId === place.id
                ? `Dagdeel ${index + 1}: ${place.title} — klik op de kaart voor de nieuwe plek, Escape annuleert`
                : `Dagdeel ${index + 1}: ${place.title}`
            }
            // Zelfde truc als het nummerbolletje in de dagplanning: de marker
            // blijft 28px groot, het raakvlak eromheen wordt 44px. Een grotere
            // marker zou de kaart eronder verstoppen. 2,5 en niet 2: `inset`
            // rekent vanaf de padding-box, en daar gaat de rand van 2px af.
            className={`relative flex size-7 items-center justify-center rounded-full border-2 text-xs font-semibold text-on-primary shadow-sm transition-transform pointer-coarse:before:absolute pointer-coarse:before:-inset-2.5 ${
              mapPick?.mode === "verplaatsen" && mapPick.activityId === place.id
                ? "animate-pulse scale-125 border-danger bg-primary-hover"
                : hoveredActivityId === place.id || selectedActivityId === place.id
                  ? "scale-125 border-secondary bg-primary-hover"
                  : "border-secondary bg-primary"
            }`}
          >
            {index + 1}
          </button>
        </Marker>
      ))}
    </Map>
  );
}
