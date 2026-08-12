import type { DayRoute } from "@/lib/route";

/**
 * Domeinmodel.
 *
 * IDs zijn UUID's zodat records hun identiteit houden bij een latere migratie
 * naar een database. `updatedAt` staat op elk record, nodig zodra dezelfde reis
 * vanaf meerdere apparaten bewerkt wordt.
 */

export type Trip = {
  id: string;
  ownerId: string;
  name: string;
  /** ISO-datum, YYYY-MM-DD */
  startDate: string;
  /** ISO-datum, YYYY-MM-DD */
  endDate: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Verwijderen gebeurt zacht: het record blijft staan met een tijdstempel in
 * `deletedAt`. Zonder dat spoor is bij het samenvoegen van twee apparaten niet
 * te zien of iets verwijderd is of nog niet bestond, en zou een verwijderd
 * dagdeel terugkomen zodra je een bestand van het andere apparaat importeert.
 */
type Verwijderbaar = {
  deletedAt: string | null;
};

export type Day = Verwijderbaar & {
  id: string;
  tripId: string;
  /** ISO-datum, YYYY-MM-DD */
  date: string;
  /** Vrije notitie als HTML, geschreven in de editor van de dagplanning. */
  notes: string;
  /**
   * Favoriet waar je deze dag verblijft. Null betekent: dezelfde als de vorige
   * dag met een keuze. Je slaapt meestal meer dan één nacht op dezelfde plek,
   * dus zou elke dag opnieuw kiezen alleen maar werk zijn.
   */
  stayFavoriteId: string | null;
  /** Begint de route van deze dag bij de verblijfplaats? */
  startAtStay: boolean;
  /** Eindigt de route van deze dag weer bij de verblijfplaats? */
  endAtStay: boolean;
  updatedAt: string;
};

/**
 * Plek die je vaker nodig hebt dan één dagdeel: het hotel, de supermarkt om de
 * hoek. Hoort bij de reis, niet bij een dag, en kan als dagdeel in elke
 * dagplanning gezet worden.
 */
export type Favorite = Verwijderbaar & {
  id: string;
  tripId: string;
  name: string;
  lat: number;
  lng: number;
  updatedAt: string;
};

/**
 * Aan een dagdeel gehangen GPX-bestand: de wandeling of fietsrit die je daar
 * doet. De inhoud gaat als tekst mee in de reisdata, zodat de track ook op je
 * telefoon staat na een export en import.
 */
export type GpxFile = {
  /** Bestandsnaam zoals geüpload; ook de naam waaronder hij gedeeld wordt. */
  name: string;
  /** De ruwe inhoud van het bestand. */
  xml: string;
};

/** Plek op de kaart, hoort bij één dagdeel. */
export type ActivityLocation = {
  name: string;
  lat: number;
  lng: number;
};

/**
 * Dagdeel: de enige bouwsteen van de planning. Heeft het een locatie, dan
 * verschijnt het als marker op de kaart en als punt in de dagroute. De
 * planning is leidend: de volgorde van de dagdelen is de volgorde van de route.
 */
export type Activity = Verwijderbaar & {
  id: string;
  dayId: string;
  /**
   * Vrije tekst: "09:00 - 11:00", "Namiddag", "na de lunch". Bewust niet
   * gestructureerd, zodat vage tijdsaanduidingen ook kunnen.
   */
  time: string;
  title: string;
  /** Vrije notitie als HTML, geschreven in de editor van het detailpaneel. */
  notes: string;
  /** Null als het dagdeel geen plek op de kaart heeft. */
  location: ActivityLocation | null;
  /** Null als er geen GPX-track bij dit dagdeel hoort. */
  gpx: GpxFile | null;
  /** Positie binnen de dag, oplopend vanaf 0 */
  order: number;
  updatedAt: string;
};

/**
 * Bewaarde route van één dag. Onderweg is er geen internet om OSRM te vragen,
 * dus wordt het antwoord bij de reis opgeslagen en reist het mee in de export.
 */
export type RouteCache = {
  dayId: string;
  /**
   * De punten waarvoor deze route gold, als tekst. Wijkt die af van de huidige
   * punten, dan hoort de bewaarde route niet meer bij deze dag en gebruiken we
   * hem niet.
   */
  waypointsKey: string;
  route: DayRoute;
  updatedAt: string;
};

/** Alles wat bij één reis hoort, zoals de repository het teruggeeft. */
export type TripData = {
  trip: Trip;
  days: Day[];
  activities: Activity[];
  favorites: Favorite[];
  routes: RouteCache[];
};
