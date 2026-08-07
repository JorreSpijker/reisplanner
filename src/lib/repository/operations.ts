import { datesBetween } from "@/lib/dates";
import type { Activity, Day, RouteCache, Trip, TripData } from "@/lib/types";

/**
 * Bewerkingen op een reis, los van waar hij is opgeslagen. Elke functie krijgt
 * een `TripData` en geeft een nieuwe terug; de repository doet alleen lezen en
 * schrijven. Zo staat deze logica één keer in de code, ongeacht of de opslag
 * IndexedDB is of later een database.
 */

export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();

/**
 * Brengt opgeslagen data op de huidige vorm. De reis en de dagen blijven; de
 * planning van vóór de dagdelen niet. Losse stops bestaan niet meer, en
 * tijdsloten van toen missen een locatie — te herkennen aan het ontbreken van
 * de sleutel `location`. Daar valt niets zinnigs van te maken, dus begint de
 * planning leeg in plaats van half ingevuld.
 */
export function normalize(data: TripData): TripData {
  const activities = (data.activities ?? []).filter(
    (activity) => "location" in activity,
  );

  return {
    trip: data.trip,
    days: data.days.map(withTombstone),
    activities: activities.map(withTombstone),
    // Bewaarde routes van vóór de dagdelen horen bij stops die er niet meer
    // zijn; ze zouden toch nooit meer op de huidige sleutel passen.
    routes: (data.routes ?? []).filter((route) => route.waypointsKey !== undefined),
  };
}

/** Records van vóór de zachte verwijdering hebben nog geen `deletedAt`. */
function withTombstone<T extends { deletedAt?: string | null }>(record: T): T {
  return record.deletedAt === undefined ? { ...record, deletedAt: null } : record;
}

/** Alleen wat niet verwijderd is — voor alles wat de app te zien krijgt. */
export function withoutDeleted(data: TripData): TripData {
  const days = data.days.filter((day) => !day.deletedAt);
  const liveDayIds = new Set(days.map((day) => day.id));

  return {
    trip: data.trip,
    days,
    activities: data.activities.filter(
      (activity) => !activity.deletedAt && liveDayIds.has(activity.dayId),
    ),
    routes: data.routes.filter((route) => liveDayIds.has(route.dayId)),
  };
}

/** Bewaart de route van één dag; per dag houden we er één. */
export function upsertRoute(data: TripData, cache: RouteCache): TripData {
  const zonderOude = data.routes.filter((route) => route.dayId !== cache.dayId);
  return { ...data, routes: [...zonderOude, cache] };
}

/** Markeert één record als verwijderd; de rest blijft staan voor het samenvoegen. */
function markDeleted<T extends { id: string; deletedAt: string | null; updatedAt: string }>(
  records: T[],
  id: string,
  timestamp: string,
): T[] {
  return records.map((record) =>
    record.id === id ? { ...record, deletedAt: timestamp, updatedAt: timestamp } : record,
  );
}

export function createTripData(
  ownerId: string,
  input: { name: string; startDate: string; endDate: string },
): TripData {
  const timestamp = now();
  const trip: Trip = {
    id: uid(),
    ownerId,
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const days = datesBetween(input.startDate, input.endDate).map<Day>((date) => ({
    id: uid(),
    tripId: trip.id,
    date,
    notes: "",
    updatedAt: timestamp,
    deletedAt: null,
  }));

  return { trip, days, activities: [], routes: [] };
}

export function applyTripPatch(
  data: TripData,
  patch: Pick<Trip, "id"> & Partial<Pick<Trip, "name" | "startDate" | "endDate">>,
): TripData {
  const timestamp = now();
  const trip: Trip = { ...data.trip, ...patch, updatedAt: timestamp };

  // Dagen volgen de reisdatums. Een dag die binnen het bereik valt blijft (of
  // komt terug) met zijn notities; een dag erbuiten wordt gemarkeerd als
  // verwijderd in plaats van weggegooid, zodat het samenvoegen hem niet
  // opnieuw laat opduiken.
  const dates = new Set(datesBetween(trip.startDate, trip.endDate));
  const byDate = new Map(data.days.map((day) => [day.date, day]));

  const bestaande = data.days.map<Day>((day) => {
    const hoortErbij = dates.has(day.date);
    if (hoortErbij && day.deletedAt) {
      return { ...day, deletedAt: null, updatedAt: timestamp };
    }
    if (!hoortErbij && !day.deletedAt) {
      return { ...day, deletedAt: timestamp, updatedAt: timestamp };
    }
    return day;
  });

  const nieuwe = [...dates]
    .filter((date) => !byDate.has(date))
    .map<Day>((date) => ({
      id: uid(),
      tripId: trip.id,
      date,
      notes: "",
      updatedAt: timestamp,
      deletedAt: null,
    }));

  const days = [...bestaande, ...nieuwe].sort((a, b) => a.date.localeCompare(b.date));
  const vervallenDagen = new Set(
    days.filter((day) => day.deletedAt).map((day) => day.id),
  );

  const markeerBijVervallenDag = <T extends { dayId: string; deletedAt: string | null }>(
    records: T[],
  ) =>
    records.map((record) =>
      vervallenDagen.has(record.dayId) && !record.deletedAt
        ? { ...record, deletedAt: timestamp, updatedAt: timestamp }
        : record,
    );

  return {
    trip,
    days,
    activities: markeerBijVervallenDag(data.activities),
    routes: data.routes,
  };
}

export function upsertDay(data: TripData, day: Day): { data: TripData; saved: Day } {
  const saved: Day = { ...day, updatedAt: now() };
  return {
    data: {
      ...data,
      days: data.days.map((existing) => (existing.id === saved.id ? saved : existing)),
    },
    saved,
  };
}

export function reorderActivities(
  data: TripData,
  dayId: string,
  activityIds: string[],
): { data: TripData; saved: Activity[] } {
  const timestamp = now();
  const order = new Map(activityIds.map((id, index) => [id, index]));

  const activities = data.activities.map<Activity>((activity) =>
    activity.dayId === dayId && !activity.deletedAt && order.has(activity.id)
      ? { ...activity, order: order.get(activity.id)!, updatedAt: timestamp }
      : activity,
  );

  return {
    data: { ...data, activities },
    saved: activities
      .filter((activity) => activity.dayId === dayId && !activity.deletedAt)
      .sort((a, b) => a.order - b.order),
  };
}

export function upsertActivity(
  data: TripData,
  activity: Activity,
): { data: TripData; saved: Activity } {
  const saved: Activity = { ...activity, updatedAt: now() };
  const exists = data.activities.some((existing) => existing.id === saved.id);
  return {
    data: {
      ...data,
      activities: exists
        ? data.activities.map((existing) =>
            existing.id === saved.id ? saved : existing,
          )
        : [...data.activities, saved],
    },
    saved,
  };
}

export function removeActivity(data: TripData, activityId: string): TripData {
  return { ...data, activities: markDeleted(data.activities, activityId, now()) };
}
