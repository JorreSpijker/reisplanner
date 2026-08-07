import type { Activity, Day, RouteCache, TripData } from "@/lib/types";
import { normalize } from "./operations";

/**
 * Samenvoegen van twee versies van dezelfde reis.
 *
 * Zonder server komen wijzigingen van het andere apparaat binnen als bestand.
 * Importeren mag daarom nooit overschrijven: dan verdwijnt wat je op dít
 * apparaat hebt gedaan. Per record wint de hoogste `updatedAt`, en omdat
 * verwijderen alleen een veld zet doet ook dat gewoon mee in die vergelijking.
 */

export type MergeChange = {
  soort: "dag" | "dagdeel";
  naam: string;
  actie: "nieuw" | "bijgewerkt" | "verwijderd";
};

export type MergeResult = {
  data: TripData;
  changes: MergeChange[];
};

/** Twee bestanden horen alleen bij elkaar als het om dezelfde reis gaat. */
export function isSameTrip(a: TripData, b: TripData): boolean {
  return a.trip.id === b.trip.id;
}

export function mergeTrips(eigen: TripData, binnengekomen: TripData): MergeResult {
  const mijn = normalize(eigen);
  const hun = normalize(binnengekomen);

  const changes: MergeChange[] = [];

  const days = mergeCollection<Day>(mijn.days, hun.days, "dag", (day) => day.date, changes);
  const activities = mergeCollection<Activity>(
    mijn.activities,
    hun.activities,
    "dagdeel",
    (activity) => activity.title,
    changes,
  );

  return {
    data: {
      trip: hun.trip.updatedAt > mijn.trip.updatedAt ? hun.trip : mijn.trip,
      days: [...days].sort((a, b) => a.date.localeCompare(b.date)),
      activities: renumber(activities),
      routes: mergeRoutes(mijn.routes, hun.routes),
    },
    changes,
  };
}

/**
 * Bewaarde routes zijn afgeleide gegevens: per dag houden we de nieuwste. Ze
 * verschijnen bewust niet in het wijzigingsoverzicht — dat gaat over wat jij
 * hebt ingevoerd, niet over wat de app zelf heeft opgehaald.
 */
function mergeRoutes(mijn: RouteCache[], hun: RouteCache[]): RouteCache[] {
  const perDag = new Map(mijn.map((route) => [route.dayId, route]));

  for (const route of hun) {
    const eigen = perDag.get(route.dayId);
    if (!eigen || route.updatedAt > eigen.updatedAt) perDag.set(route.dayId, route);
  }

  return [...perDag.values()];
}

type Record = { id: string; updatedAt: string; deletedAt: string | null };

function mergeCollection<T extends Record>(
  mijn: T[],
  hun: T[],
  soort: MergeChange["soort"],
  label: (record: T) => string,
  changes: MergeChange[],
): T[] {
  const bijMij = new Map(mijn.map((record) => [record.id, record]));
  const resultaat = new Map(bijMij);

  for (const binnen of hun) {
    const eigen = bijMij.get(binnen.id);

    if (!eigen) {
      resultaat.set(binnen.id, binnen);
      // Een grafsteen die ik nog niet kende verandert niets aan wat ik zie.
      if (!binnen.deletedAt) {
        changes.push({ soort, naam: label(binnen), actie: "nieuw" });
      }
      continue;
    }

    if (binnen.updatedAt <= eigen.updatedAt) continue;

    resultaat.set(binnen.id, binnen);
    changes.push({
      soort,
      naam: label(binnen),
      actie: binnen.deletedAt && !eigen.deletedAt ? "verwijderd" : "bijgewerkt",
    });
  }

  return [...resultaat.values()];
}

/**
 * Nummert de volgorde per dag opnieuw. Verslepen beide apparaten iets, dan
 * kunnen twee records dezelfde positie krijgen; de sortering hieronder is
 * volledig bepaald, dus beide apparaten komen op dezelfde uitkomst uit.
 *
 * Dit past `updatedAt` bewust niet aan: anders zou het hernummeren zelf een
 * wijziging worden die de apparaten heen en weer naar elkaar blijven sturen.
 */
function renumber<T extends Record & { dayId: string; order: number }>(records: T[]): T[] {
  const perDag = new Map<string, T[]>();
  for (const record of records) {
    if (record.deletedAt) continue;
    const lijst = perDag.get(record.dayId) ?? [];
    lijst.push(record);
    perDag.set(record.dayId, lijst);
  }

  const nieuweVolgorde = new Map<string, number>();
  for (const lijst of perDag.values()) {
    lijst
      .sort(
        (a, b) =>
          a.order - b.order ||
          a.updatedAt.localeCompare(b.updatedAt) ||
          a.id.localeCompare(b.id),
      )
      .forEach((record, index) => nieuweVolgorde.set(record.id, index));
  }

  return records.map((record) => {
    const order = nieuweVolgorde.get(record.id);
    return order === undefined || order === record.order ? record : { ...record, order };
  });
}
