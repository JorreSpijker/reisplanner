import { openDB, type IDBPDatabase } from "idb";
import type { Activity, Day, Favorite, RouteCache, Trip, TripData } from "@/lib/types";
import type { TripRepository } from "./types";
import { mergeTrips, type MergeResult } from "./merge";
import {
  applyTripPatch,
  createTripData,
  moveActivities,
  normalize,
  removeActivity,
  removeFavorite,
  reorderActivities,
  upsertActivity,
  upsertDay,
  upsertFavorite,
  upsertRoute,
  withoutDeleted,
} from "./operations";

const DB_NAME = "reisplanner";
const DB_VERSION = 1;
const STORE = "trips";

/** Sleutel waaronder de vorige versie in localStorage schreef. */
const LEGACY_PREFIX = "reisplanner:trip:";
const MIGRATED_PREFIX = "reisplanner:overgezet:";

/**
 * Opslag in IndexedDB. Eén record per gebruiker met de hele reis erin: bij deze
 * omvang is dat eenvoudiger dan losse stores per soort, en het houdt het later
 * samenvoegen van twee apparaten overzichtelijk.
 *
 * De database wordt pas geopend bij het eerste gebruik. Dat moet ook: dit
 * bestand wordt tijdens het serverrenderen geladen, waar `indexedDB` niet
 * bestaat.
 */
export class IndexedDbRepository implements TripRepository {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private db(): Promise<IDBPDatabase> {
    this.dbPromise ??= openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore(STORE);
      },
    });
    return this.dbPromise;
  }

  /**
   * Alles wat is opgeslagen, inclusief de verwijderde records. Voor schrijven
   * en straks voor het samenvoegen; de app krijgt dit niet te zien.
   */
  private async read(userId: string): Promise<TripData | null> {
    const db = await this.db();
    const stored = (await db.get(STORE, userId)) as TripData | undefined;
    if (stored) return normalize(stored);

    const overgezet = await this.migrateFromLocalStorage(userId);
    return overgezet ? normalize(overgezet) : null;
  }

  private async write(userId: string, data: TripData): Promise<TripData> {
    const db = await this.db();
    await db.put(STORE, data, userId);
    return data;
  }

  /** Leest de reis of gooit als die er niet is — voor schrijfacties. */
  private async require(userId: string): Promise<TripData> {
    const data = await this.read(userId);
    if (!data) throw new Error("Geen reis gevonden voor deze gebruiker");
    return data;
  }

  /**
   * Haalt een reis uit de vorige opslag over, één keer per gebruiker. Het
   * origineel blijft staan: zolang er geen server is, is dat de enige andere
   * kopie die er bestaat.
   */
  private async migrateFromLocalStorage(userId: string): Promise<TripData | null> {
    if (window.localStorage.getItem(`${MIGRATED_PREFIX}${userId}`)) return null;

    const raw = window.localStorage.getItem(`${LEGACY_PREFIX}${userId}`);
    window.localStorage.setItem(`${MIGRATED_PREFIX}${userId}`, new Date().toISOString());
    if (!raw) return null;

    const data = normalize(JSON.parse(raw) as TripData);
    return this.write(userId, data);
  }

  async loadTrip(userId: string): Promise<TripData | null> {
    const data = await this.read(userId);
    return data ? withoutDeleted(data) : null;
  }

  async createTrip(
    userId: string,
    input: { name: string; startDate: string; endDate: string },
  ): Promise<TripData> {
    return withoutDeleted(await this.write(userId, createTripData(userId, input)));
  }

  async updateTrip(
    userId: string,
    patch: Pick<Trip, "id"> & Partial<Pick<Trip, "name" | "startDate" | "endDate">>,
  ): Promise<TripData> {
    const data = applyTripPatch(await this.require(userId), patch);
    await this.write(userId, data);
    return withoutDeleted(data);
  }

  async saveDay(userId: string, day: Day): Promise<Day> {
    const { data, saved } = upsertDay(await this.require(userId), day);
    await this.write(userId, data);
    return saved;
  }

  async saveActivity(userId: string, activity: Activity): Promise<Activity> {
    const { data, saved } = upsertActivity(await this.require(userId), activity);
    await this.write(userId, data);
    return saved;
  }

  async deleteActivity(userId: string, activityId: string): Promise<void> {
    await this.write(userId, removeActivity(await this.require(userId), activityId));
  }

  async reorderActivities(
    userId: string,
    dayId: string,
    activityIds: string[],
  ): Promise<Activity[]> {
    const { data, saved } = reorderActivities(
      await this.require(userId),
      dayId,
      activityIds,
    );
    await this.write(userId, data);
    return saved;
  }

  async moveActivities(
    userId: string,
    input: {
      sourceDayId: string;
      targetDayId: string;
      activityIds: string[];
      withNotes: boolean;
    },
  ): Promise<TripData> {
    const data = moveActivities(await this.require(userId), input);
    await this.write(userId, data);
    return withoutDeleted(data);
  }

  async saveFavorite(userId: string, favorite: Favorite): Promise<Favorite> {
    const { data, saved } = upsertFavorite(await this.require(userId), favorite);
    await this.write(userId, data);
    return saved;
  }

  async deleteFavorite(userId: string, favoriteId: string): Promise<void> {
    await this.write(userId, removeFavorite(await this.require(userId), favoriteId));
  }

  async saveRoute(userId: string, cache: RouteCache): Promise<void> {
    await this.write(userId, upsertRoute(await this.require(userId), cache));
  }

  async exportTrip(userId: string): Promise<TripData | null> {
    return this.read(userId);
  }

  async importTrip(userId: string, binnengekomen: TripData): Promise<MergeResult> {
    const eigen = await this.read(userId);

    // Nog geen reis op dit apparaat: samenvoegen met een lege reis geeft
    // hetzelfde resultaat en meteen een net overzicht van wat erbij komt.
    const basis: TripData = eigen ?? {
      trip: binnengekomen.trip,
      days: [],
      activities: [],
      favorites: [],
      routes: [],
    };

    const resultaat = mergeTrips(basis, binnengekomen);
    await this.write(userId, resultaat.data);
    return resultaat;
  }
}
