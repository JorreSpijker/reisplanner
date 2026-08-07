"use client";

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
import { useActiveDayPlaces, useTripStore } from "@/lib/store";

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

/** Beeld bij een dag zonder locaties: West-Europa. */
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
  const [loaded, setLoaded] = useState(false);
  const mapStyle = useMapStyle();
  const places = useActiveDayPlaces();
  const hoveredActivityId = useTripStore((state) => state.hoveredActivityId);
  const setHoveredActivity = useTripStore((state) => state.setHoveredActivity);
  const route = useTripStore((state) => state.route);
  const mapPick = useTripStore((state) => state.mapPick);
  const setMapPick = useTripStore((state) => state.setMapPick);
  const setDraftLocation = useTripStore((state) => state.setDraftLocation);
  const saveActivity = useTripStore((state) => state.saveActivity);
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

  /** Kiezen afbreken en terug naar het paneel waar het vandaan kwam. */
  const annuleerKeuze = useCallback(() => {
    if (!mapPick) return;
    setMapPick(null);
    setMobileTab(mapPick.mode === "nieuw" ? "dag" : "dagdeel");
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
   * Een klik telt alleen als de kaart in kiesmodus staat, gezet met de
   * kiesknop in de dagplanning of in het dagdeelpaneel. Anders zou pannen en
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

    if (mapPick.mode === "locatie") {
      const activity = activities?.find(
        (kandidaat) => kandidaat.id === mapPick.activityId,
      );
      if (activity) {
        await saveActivity(user.id, { ...activity, location: { name, lat, lng } });
      }
      setMobileTab("dagdeel");
      return;
    }

    // Het formulier in de dagplanning maakt er een dagdeel van.
    setDraftLocation({ name, lat, lng });
    setMobileTab("dag");
  }

  // Bij wisselen van dag het beeld om de locaties van die dag leggen. Wacht op
  // `loaded`: vóór dat moment negeert MapLibre camera-opdrachten.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || places.length === 0) return;

    if (places.length === 1) {
      const { lng, lat } = places[0].location;
      map.easeTo({ center: [lng, lat], zoom: 13, duration: 600 });
      return;
    }

    const lngs = places.map((place) => place.location.lng);
    const lats = places.map((place) => place.location.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 64, maxZoom: 15, duration: 600 },
    );
  }, [places, loaded]);

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
      onLoad={() => setLoaded(true)}
      onClick={handleClick}
      cursor={mapPick ? "crosshair" : undefined}
    >
      <NavigationControl position="top-right" showCompass={false} />

      {/*
        Op mobiel staat de dagkolom in een ander tabblad, dus moet de kaart zelf
        vertellen dat hij op een klik wacht.
      */}
      {mapPick && (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex items-center gap-3 rounded-md border border-danger bg-surface px-3 py-2 text-xs text-text-muted shadow-md lg:inset-x-auto lg:bottom-auto lg:left-3 lg:top-3 lg:max-w-sm"
        >
          <span className="flex-1">
            {mapPick.mode === "verplaatsen"
              ? "Klik op de kaart om de nieuwe plek te kiezen."
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
            className={`flex size-7 items-center justify-center rounded-full border-2 text-xs font-semibold text-on-primary shadow-sm transition-transform ${
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
