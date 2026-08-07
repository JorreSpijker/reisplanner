import { IndexedDbRepository } from "./indexeddb";
import type { TripRepository } from "./types";

export type { TripRepository } from "./types";

let instance: TripRepository | null = null;

/**
 * Enige plek waar de implementatie gekozen wordt. Wisselen naar een database
 * betekent hier één regel aanpassen.
 */
export function getRepository(): TripRepository {
  instance ??= new IndexedDbRepository();
  return instance;
}
