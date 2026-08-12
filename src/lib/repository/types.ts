import type { Activity, Day, Favorite, RouteCache, Trip, TripData } from "@/lib/types";
import type { MergeResult } from "./merge";

/**
 * Enige toegangspoort tot opgeslagen data. Componenten praten hiermee en nooit
 * rechtstreeks met localStorage, zodat een `SupabaseRepository` er later voor
 * in de plaats kan zonder de rest aan te raken.
 *
 * Alles is async, ook al is localStorage synchroon. Anders breekt bij de
 * overstap naar een database alsnog elk component dat data ophaalt.
 *
 * Elke methode krijgt een `userId` mee. Zolang er geen login is, komt die uit
 * de lokale sessie-stub; na SSO komt hij uit de echte sessie.
 */
export interface TripRepository {
  /** Reis van deze gebruiker, of null als er nog geen is. */
  loadTrip(userId: string): Promise<TripData | null>;

  createTrip(
    userId: string,
    input: { name: string; startDate: string; endDate: string },
  ): Promise<TripData>;

  updateTrip(
    userId: string,
    patch: Pick<Trip, "id"> & Partial<Pick<Trip, "name" | "startDate" | "endDate">>,
  ): Promise<TripData>;

  saveDay(userId: string, day: Day): Promise<Day>;

  /**
   * Zet de dagen in een andere volgorde; `dayIds` staat in de nieuwe volgorde.
   * De datums van de reis blijven staan, de dagen schuiven erlangs.
   */
  reorderDays(userId: string, dayIds: string[]): Promise<TripData>;

  saveActivity(userId: string, activity: Activity): Promise<Activity>;
  deleteActivity(userId: string, activityId: string): Promise<void>;
  /** Herordent dagdelen binnen één dag; `activityIds` staat in de nieuwe volgorde. */
  reorderActivities(
    userId: string,
    dayId: string,
    activityIds: string[],
  ): Promise<Activity[]>;

  /**
   * Verplaatst dagdelen naar een andere dag; ze komen achter wat daar al staat.
   * Met `withNotes` verhuist de notitie van de dag mee.
   */
  moveActivities(
    userId: string,
    input: {
      sourceDayId: string;
      targetDayId: string;
      activityIds: string[];
      withNotes: boolean;
    },
  ): Promise<TripData>;

  /** Bewaart een favoriete plek van de reis, of werkt hem bij. */
  saveFavorite(userId: string, favorite: Favorite): Promise<Favorite>;
  deleteFavorite(userId: string, favoriteId: string): Promise<void>;

  /** Bewaart de opgehaalde route van een dag, zodat hij offline blijft werken. */
  saveRoute(userId: string, cache: RouteCache): Promise<void>;

  /**
   * De hele reis inclusief de verwijderde records. Alleen voor exporteren: het
   * andere apparaat moet weten wát je verwijderd hebt, anders zet het die
   * records bij de volgende uitwisseling gewoon terug.
   */
  exportTrip(userId: string): Promise<TripData | null>;

  /** Voegt een geïmporteerde reis samen met wat er al staat. */
  importTrip(userId: string, binnengekomen: TripData): Promise<MergeResult>;
}
