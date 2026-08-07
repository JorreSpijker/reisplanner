import { useEffect } from "react";
import { create } from "zustand";
import { shiftDate } from "@/lib/dates";
import { getRepository } from "@/lib/repository";
import type { MergeResult } from "@/lib/repository/merge";
import { routeKey, straightLineRoute, type DayRoute } from "@/lib/route";
import type {
  Activity,
  ActivityLocation,
  Day,
  Favorite,
  RouteCache,
  TripData,
} from "@/lib/types";

export type MobileTab = "dag" | "kaart" | "dagdeel";

/** Dagdeel met een plek op de kaart; alleen deze tellen mee voor de route. */
export type LocatedActivity = Activity & { location: ActivityLocation };

/**
 * De kaart staat klaar om een punt aan te wijzen. Wat er met dat punt gebeurt
 * hangt af van waar de gebruiker de kiesknop indrukte.
 */
export type MapPick =
  /** Het punt wordt een nieuwe favoriet van de reis. */
  | { mode: "favoriet" }
  /** Het punt wordt de locatie van een dagdeel dat er nog geen had. */
  | { mode: "locatie"; activityId: string }
  /** Het punt vervangt de coördinaten; de naam van de locatie blijft staan. */
  | { mode: "verplaatsen"; activityId: string };

/**
 * In-memory state van de actieve reis. Persistentie loopt altijd via de
 * repository, niet via zustand `persist` — anders zouden er twee plekken zijn
 * die naar localStorage schrijven en zou de repository te omzeilen zijn.
 */
type TripState = {
  data: TripData | null;
  status: "idle" | "loading" | "ready" | "error";
  activeDayId: string | null;
  /** Dagdeel waar de gebruiker overheen zweeft, in de planning of op de kaart. */
  hoveredActivityId: string | null;
  /** Staat de kaart klaar om een punt aan te wijzen, en waarvoor. */
  mapPick: MapPick | null;
  /** Dagdeel waarvan het detailpaneel openstaat. */
  selectedActivityId: string | null;
  /**
   * Zichtbaar paneel op mobiel. Op desktop staan alle drie naast elkaar en
   * doet dit niets.
   */
  mobileTab: MobileTab;
  /** Route langs de dagdelen met locatie; afgeleid, niet opgeslagen. */
  route: DayRoute | null;
  routeStatus: "idle" | "loading";

  load: (userId: string) => Promise<void>;
  createTrip: (
    userId: string,
    input: { name: string; startDate: string; endDate: string },
  ) => Promise<void>;
  setActiveDay: (dayId: string) => void;
  /** Rekt de reis één dag op, vóór de eerste of na de laatste dag. */
  addDay: (userId: string, kant: "voor" | "na") => Promise<void>;
  setHoveredActivity: (activityId: string | null) => void;
  setMapPick: (pick: MapPick | null) => void;
  setSelectedActivity: (activityId: string | null) => void;
  setMobileTab: (tab: MobileTab) => void;
  /**
   * Voegt een dagdeel achteraan de dagplanning toe. Een locatie geef je alleen
   * mee vanuit een favoriet; verder zet je die in het dagdeelpaneel.
   */
  addActivity: (
    userId: string,
    dayId: string,
    input: { time: string; title: string; location?: ActivityLocation },
  ) => Promise<Activity | null>;
  saveActivity: (userId: string, activity: Activity) => Promise<void>;
  deleteActivity: (userId: string, activityId: string) => Promise<void>;
  reorderActivities: (
    userId: string,
    dayId: string,
    activityIds: string[],
  ) => Promise<void>;
  /** Verplaatst dagdelen, en eventueel de dagnotitie, naar een andere dag. */
  moveActivities: (
    userId: string,
    input: {
      sourceDayId: string;
      targetDayId: string;
      activityIds: string[];
      withNotes: boolean;
    },
  ) => Promise<void>;
  /** Zet de locatie van een dagdeel op nieuwe coördinaten; de naam blijft staan. */
  moveActivity: (
    userId: string,
    activityId: string,
    lat: number,
    lng: number,
  ) => Promise<void>;
  saveFavorite: (userId: string, favorite: Favorite) => Promise<void>;
  deleteFavorite: (userId: string, favoriteId: string) => Promise<void>;
  /** Zet de verblijfplaats van een dag; null neemt die van de vorige dag over. */
  setDayStay: (userId: string, dayId: string, favoriteId: string | null) => Promise<void>;
  loadRoute: (
    userId: string,
    places: LocatedActivity[],
    stay: DayStay | null,
  ) => Promise<void>;
  /** De hele reis inclusief verwijderde records, om weg te schrijven. */
  exportTrip: (userId: string) => Promise<TripData | null>;
  importTrip: (userId: string, binnengekomen: TripData) => Promise<MergeResult>;
  saveDay: (userId: string, day: Day) => Promise<void>;
};

const repository = getRepository();

/** Houdt bij welk route-verzoek het laatste is, zodat trage antwoorden niet
 * een nieuwere route overschrijven. */
let routeRequestId = 0;

/**
 * Verblijfplaats van een dag, met wat die dag ermee doet. Een dag waarop je
 * doorreist vertrekt wel bij het hotel maar komt er niet terug, dus staan heen
 * en terug los van elkaar.
 */
export type DayStay = { favorite: Favorite; vanaf: boolean; terug: boolean };

/** De punten waarop de routedienst en de bewaarde route werken. */
function waypoints(places: LocatedActivity[], stay: DayStay | null) {
  const onderweg = places.map((place) => ({
    id: place.id,
    lat: place.location.lat,
    lng: place.location.lng,
  }));

  if (!stay || onderweg.length === 0) return onderweg;

  const verblijf = { lat: stay.favorite.lat, lng: stay.favorite.lng };

  return [
    ...(stay.vanaf ? [{ id: `${stay.favorite.id}:heen`, ...verblijf }] : []),
    ...onderweg,
    ...(stay.terug ? [{ id: `${stay.favorite.id}:terug`, ...verblijf }] : []),
  ];
}

export const useTripStore = create<TripState>((set, get) => ({
  data: null,
  status: "idle",
  activeDayId: null,
  hoveredActivityId: null,
  mapPick: null,
  selectedActivityId: null,
  // Onderweg lees je vooral de dagplanning; die staat daarom vooraan.
  mobileTab: "dag",
  route: null,
  routeStatus: "idle",

  load: async (userId) => {
    set({ status: "loading" });
    try {
      const data = await repository.loadTrip(userId);
      set({
        data,
        status: "ready",
        activeDayId: data?.days[0]?.id ?? null,
      });
    } catch (cause) {
      // Zonder server is de browseropslag de enige kopie. Bij een leesfout een
      // leeg beginscherm tonen wekt de indruk dat de reis weg is; dat mag niet.
      console.error("Reis laden mislukt", cause);
      set({ data: null, status: "error" });
    }
  },

  createTrip: async (userId, input) => {
    const data = await repository.createTrip(userId, input);
    set({ data, status: "ready", activeDayId: data.days[0]?.id ?? null });
  },

  // Een openstaande kaartkeuze hoort bij de dag waar je hem begon; bij het
  // wisselen van dag vervalt hij.
  setActiveDay: (dayId) => set({ activeDayId: dayId, mapPick: null }),
  addDay: async (userId, kant) => {
    const trip = get().data?.trip;
    if (!trip) return;

    const patch =
      kant === "voor"
        ? { id: trip.id, startDate: shiftDate(trip.startDate, -1) }
        : { id: trip.id, endDate: shiftDate(trip.endDate, 1) };

    const data = await repository.updateTrip(userId, patch);
    const datum = kant === "voor" ? data.trip.startDate : data.trip.endDate;

    // Meteen naar de nieuwe dag: die voeg je toe om hem in te vullen.
    set({
      data,
      activeDayId: data.days.find((day) => day.date === datum)?.id ?? get().activeDayId,
      mapPick: null,
    });
  },

  setHoveredActivity: (activityId) => set({ hoveredActivityId: activityId }),
  setMapPick: (pick) => set({ mapPick: pick }),
  setSelectedActivity: (activityId) => set({ selectedActivityId: activityId }),
  setMobileTab: (tab) => set({ mobileTab: tab }),

  addActivity: async (userId, dayId, input) => {
    const data = get().data;
    if (!data) return null;

    const order = data.activities.filter((activity) => activity.dayId === dayId).length;
    const activity: Activity = {
      id: crypto.randomUUID(),
      dayId,
      time: input.time,
      title: input.title,
      notes: "",
      location: input.location ?? null,
      order,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };
    await get().saveActivity(userId, activity);
    return activity;
  },

  saveActivity: async (userId, activity) => {
    const saved = await repository.saveActivity(userId, activity);
    const data = get().data;
    if (!data) return;
    const exists = data.activities.some((existing) => existing.id === saved.id);
    set({
      data: {
        ...data,
        activities: exists
          ? data.activities.map((existing) =>
              existing.id === saved.id ? saved : existing,
            )
          : [...data.activities, saved],
      },
    });
  },

  deleteActivity: async (userId, activityId) => {
    await repository.deleteActivity(userId, activityId);
    const { data, mapPick, selectedActivityId } = get();
    if (!data) return;

    // Het paneel van een verwijderd dagdeel moet niet blijven staan, en de
    // kaart hoeft er ook geen punt meer voor te vragen.
    const wachtOpDitDagdeel =
      mapPick !== null && "activityId" in mapPick && mapPick.activityId === activityId;

    set({
      data: {
        ...data,
        activities: data.activities.filter((activity) => activity.id !== activityId),
      },
      selectedActivityId:
        selectedActivityId === activityId ? null : selectedActivityId,
      mapPick: wachtOpDitDagdeel ? null : mapPick,
    });
  },

  reorderActivities: async (userId, dayId, activityIds) => {
    const reordered = await repository.reorderActivities(userId, dayId, activityIds);
    const data = get().data;
    if (!data) return;
    const byId = new Map(reordered.map((activity) => [activity.id, activity]));
    set({
      data: {
        ...data,
        activities: data.activities.map((activity) => byId.get(activity.id) ?? activity),
      },
    });
  },

  moveActivities: async (userId, input) => {
    const data = await repository.moveActivities(userId, input);
    const selectedActivityId = get().selectedActivityId;

    // Het detailpaneel hoort bij de dag die je bekijkt; een verhuisd dagdeel
    // staat daar niet meer tussen.
    set({
      data,
      selectedActivityId:
        selectedActivityId && input.activityIds.includes(selectedActivityId)
          ? null
          : selectedActivityId,
    });
  },

  saveFavorite: async (userId, favorite) => {
    const saved = await repository.saveFavorite(userId, favorite);
    const data = get().data;
    if (!data) return;
    const exists = data.favorites.some((existing) => existing.id === saved.id);
    set({
      data: {
        ...data,
        favorites: exists
          ? data.favorites.map((existing) =>
              existing.id === saved.id ? saved : existing,
            )
          : [...data.favorites, saved],
      },
    });
  },

  deleteFavorite: async (userId, favoriteId) => {
    await repository.deleteFavorite(userId, favoriteId);
    const data = get().data;
    if (!data) return;
    set({
      data: {
        ...data,
        favorites: data.favorites.filter((favorite) => favorite.id !== favoriteId),
      },
    });
  },

  setDayStay: async (userId, dayId, favoriteId) => {
    const day = get().data?.days.find((kandidaat) => kandidaat.id === dayId);
    if (!day) return;
    await get().saveDay(userId, { ...day, stayFavoriteId: favoriteId });
  },

  moveActivity: async (userId, activityId, lat, lng) => {
    const activity = get().data?.activities.find(
      (candidate) => candidate.id === activityId,
    );
    if (!activity?.location) return;

    await get().saveActivity(userId, {
      ...activity,
      location: { ...activity.location, lat, lng },
      updatedAt: new Date().toISOString(),
    });
  },

  exportTrip: async (userId) => repository.exportTrip(userId),

  importTrip: async (userId, binnengekomen) => {
    const resultaat = await repository.importTrip(userId, binnengekomen);
    // Opnieuw inlezen, zodat de app de samengevoegde reis toont zonder
    // grafstenen en met de bijgewerkte volgorde.
    await get().load(userId);
    return resultaat;
  },

  loadRoute: async (userId, places, stay) => {
    const dayId = get().activeDayId;
    const punten = waypoints(places, stay);
    if (punten.length < 2 || !dayId) {
      set({ route: null, routeStatus: "idle" });
      return;
    }

    const key = routeKey(punten);

    // Al eens opgehaald voor precies deze punten? Dan die gebruiken. Dat werkt
    // ook zonder internet en scheelt een verzoek aan de routedienst.
    const bewaard = get().data?.routes.find(
      (cache) => cache.dayId === dayId && cache.waypointsKey === key,
    );
    if (bewaard) {
      set({ route: bewaard.route, routeStatus: "idle" });
      return;
    }

    const id = ++routeRequestId;
    set({ routeStatus: "loading" });
    const coords = punten.map((punt) => `${punt.lng},${punt.lat}`).join(";");

    try {
      const response = await fetch(`/api/route?coords=${coords}`);
      if (!response.ok) throw new Error("routedienst gaf een fout");
      const route = (await response.json()) as DayRoute;
      if (id !== routeRequestId) return;

      set({ route, routeStatus: "idle" });

      // Alleen een echte route bewaren; rechte lijnen kunnen we altijd zelf
      // uitrekenen en zouden een latere echte route in de weg zitten.
      if (!route.fallback) {
        const cache: RouteCache = {
          dayId,
          waypointsKey: key,
          route,
          updatedAt: new Date().toISOString(),
        };
        await repository.saveRoute(userId, cache);

        const data = get().data;
        if (data) {
          set({
            data: {
              ...data,
              routes: [...data.routes.filter((r) => r.dayId !== dayId), cache],
            },
          });
        }
      }
    } catch {
      // Ook zonder de routedienst moet de kaart iets kunnen tekenen.
      if (id === routeRequestId) {
        set({ route: straightLineRoute(punten), routeStatus: "idle" });
      }
    }
  },

  saveDay: async (userId, day) => {
    const saved = await repository.saveDay(userId, day);
    const data = get().data;
    if (!data) return;
    set({
      data: {
        ...data,
        days: data.days.map((existing) => (existing.id === saved.id ? saved : existing)),
      },
    });
  },
}));

/**
 * Haalt de route opnieuw op zodra de dagdelen met locatie wijzigen. De sleutel
 * is een string en geen array: `useActiveDayPlaces` geeft elke render een
 * nieuwe array terug, wat anders een oneindige lus zou opleveren.
 */
export function useRouteSync(userId: string | undefined): void {
  const places = useActiveDayPlaces();
  const stay = useActiveDayStayRoute();
  const loadRoute = useTripStore((state) => state.loadRoute);
  const key = routeKey(waypoints(places, stay));

  useEffect(() => {
    if (userId) void loadRoute(userId, places, stay);
    // `key` vat de punten samen; `places` zelf is elke render een nieuwe array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, userId, loadRoute]);
}

/** Het dagdeel waarvan het detailpaneel openstaat. */
export function useSelectedActivity(): Activity | null {
  const data = useTripStore((state) => state.data);
  const selectedActivityId = useTripStore((state) => state.selectedActivityId);
  return data?.activities.find((activity) => activity.id === selectedActivityId) ?? null;
}

/** Dagdelen van één dag, op volgorde. */
export function useDayActivities(dayId: string | null): Activity[] {
  const data = useTripStore((state) => state.data);
  if (!data || !dayId) return [];
  return data.activities
    .filter((activity) => activity.dayId === dayId)
    .sort((a, b) => a.order - b.order);
}

/** De dag die nu geselecteerd is. */
export function useActiveDay(): Day | null {
  const data = useTripStore((state) => state.data);
  const activeDayId = useTripStore((state) => state.activeDayId);
  return data?.days.find((day) => day.id === activeDayId) ?? null;
}

/** Favorieten van de reis, op naam. */
export function useFavorites(): Favorite[] {
  const data = useTripStore((state) => state.data);
  return [...(data?.favorites ?? [])].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * De verblijfplaats van de actieve dag én wat de route ermee doet. Null zodra
 * die dag noch heen noch terug bij het verblijf langsgaat.
 */
export function useActiveDayStayRoute(): DayStay | null {
  const favorite = useActiveDayStay();
  const day = useActiveDay();
  if (!favorite || !day || (!day.startAtStay && !day.endAtStay)) return null;
  return { favorite, vanaf: day.startAtStay, terug: day.endAtStay };
}

/**
 * De verblijfplaats van de actieve dag. Heeft die dag zelf geen keuze, dan
 * geldt die van de laatste eerdere dag die er wel een had: je blijft in
 * hetzelfde hotel tot je verhuist.
 */
export function useActiveDayStay(): Favorite | null {
  const data = useTripStore((state) => state.data);
  const activeDayId = useTripStore((state) => state.activeDayId);
  if (!data || !activeDayId) return null;

  const dagen = [...data.days].sort((a, b) => a.date.localeCompare(b.date));
  const tot = dagen.findIndex((day) => day.id === activeDayId);
  if (tot === -1) return null;

  const keuze = dagen
    .slice(0, tot + 1)
    .reverse()
    .find((day) => day.stayFavoriteId !== null)?.stayFavoriteId;

  return data.favorites.find((favorite) => favorite.id === keuze) ?? null;
}

/**
 * Dagdelen met een locatie op de actieve dag, op volgorde van de planning.
 * Dit is de enige bron voor de markers, de nummering en de route.
 */
export function useActiveDayPlaces(): LocatedActivity[] {
  const data = useTripStore((state) => state.data);
  const activeDayId = useTripStore((state) => state.activeDayId);
  if (!data || !activeDayId) return [];
  return data.activities
    .filter(
      (activity): activity is LocatedActivity =>
        activity.dayId === activeDayId && activity.location !== null,
    )
    .sort((a, b) => a.order - b.order);
}
