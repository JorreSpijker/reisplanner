"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/session";
import { formatDistance, formatDuration, type RouteLeg } from "@/lib/route";
import {
  useActiveDayPlaces,
  useActiveDayStay,
  useActiveDayStayRoute,
  useDayActivities,
  useFavorites,
  useTripStore,
} from "@/lib/store";
import type { Activity, Day, Favorite } from "@/lib/types";
import { Collapsible } from "./collapsible";
import { ConfirmDialog } from "./confirm-dialog";
import { Favorites } from "./favorites";
import { MoveActivities } from "./move-activities";
import { RichText } from "./rich-text";
import { TrashIcon } from "./trash-icon";

/**
 * De planning van de dag: dagdelen en een notitie. Dit is de enige plek waar je
 * de dag indeelt. Een dagdeel met locatie verschijnt met hetzelfde nummer als
 * marker op de kaart en telt mee voor de route; een dagdeel zonder locatie
 * staat alleen in deze lijst.
 */
export function DayPlan({ day }: { day: Day }) {
  const { user } = useSession();
  const activities = useDayActivities(day.id);
  const favorites = useFavorites();
  const reorderActivities = useTripStore((state) => state.reorderActivities);
  const addActivity = useTripStore((state) => state.addActivity);
  // Een favoriet komt uit de strip erboven en mag dus buiten de lijst beginnen;
  // een dagdeel verslepen blijft binnen de lijst.
  const [sleeptFavoriet, setSleeptFavoriet] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    setSleeptFavoriet(event.active.data.current?.type === "favoriet");
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setSleeptFavoriet(false);
    if (!user || !over) return;

    const ids = activities.map((activity) => activity.id);
    const favorite = active.data.current?.favorite as Favorite | undefined;

    if (favorite) {
      const created = await addActivity(user.id, day.id, {
        time: "",
        title: favorite.name,
        location: { name: favorite.name, lat: favorite.lat, lng: favorite.lng },
      });

      // Losgelaten op een dagdeel: daar komt hij vóór. Elders in de lijst:
      // achteraan, waar `addActivity` hem al zette.
      const index = ids.indexOf(String(over.id));
      if (created && index !== -1) {
        await reorderActivities(user.id, day.id, [
          ...ids.slice(0, index),
          created.id,
          ...ids.slice(index),
        ]);
      }
      return;
    }

    if (active.id === over.id) return;
    const next = arrayMove(
      ids,
      ids.indexOf(String(active.id)),
      ids.indexOf(String(over.id)),
    );
    await reorderActivities(user.id, day.id, next);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={sleeptFavoriet ? [] : [restrictToVerticalAxis, restrictToParentElement]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <section className="flex flex-1 flex-col gap-6">
        <Planning day={day} userId={user?.id} />

        <div className="flex flex-col">
          <MoveActivities day={day} />
        </div>

        {/* Bijzaken: dicht tenzij je ze nodig hebt, en onderaan de kolom zodat
            de dagplanning bovenaan bij elkaar blijft staan. */}
        <div className="mt-auto border-t border-border">
          <Collapsible
            title="Favorieten"
            hint={favorites.length > 0 ? String(favorites.length) : "geen"}
          >
            <Favorites day={day} />
          </Collapsible>

          <Collapsible
            title="Notitie bij deze dag"
            hint={day.notes ? "ingevuld" : "leeg"}
          >
            <DayNote day={day} />
          </Collapsible>
        </div>
      </section>
    </DndContext>
  );
}

/** Waar een favoriet losgelaten mag worden om achteraan de dag te komen. */
const PLANNING_DROP_ID = "dagplanning";

function Planning({ day, userId }: { day: Day; userId?: string }) {
  const activities = useDayActivities(day.id);
  const places = useActiveDayPlaces();
  const stay = useActiveDayStayRoute();
  // De verblijfplaats zelf, ook als de route er deze dag niet langsgaat: anders
  // zouden de vinkjes verdwijnen zodra je ze allebei uitzet.
  const verblijf = useActiveDayStay();
  const mapPick = useTripStore((state) => state.mapPick);
  const route = useTripStore((state) => state.route);
  const routeStatus = useTripStore((state) => state.routeStatus);
  const saveDay = useTripStore((state) => state.saveDay);
  const { setNodeRef, isOver } = useDroppable({ id: PLANNING_DROP_ID });

  // Het nummer op de kaart telt alleen de dagdelen mét locatie, zodat de
  // markers op de kaart en de nummers in deze lijst gelijk lopen.
  const placeIndex = new Map(places.map((place, index) => [place.id, index]));

  // Staat het verblijf vooraan in de route, dan schuiven alle trajecten één
  // op: het eerste dagdeel heeft dan de rit vanaf het verblijf.
  const heeftPunten = stay !== null && places.length > 0;
  const vanafVerblijf = heeftPunten && stay.vanaf;
  const legOffset = vanafVerblijf ? 1 : 0;
  const terugNaarVerblijf = heeftPunten && stay.terug;
  const terugLeg = terugNaarVerblijf
    ? route?.legs[places.length + legOffset - 1]
    : undefined;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-base font-semibold">Dagplanning</h2>

      {/*
        Per dag: begint en eindigt hij bij het verblijf. Op een doorreisdag
        vertrek je er wel, maar kom je er niet terug.
      */}
      {verblijf && (
        // De naam van het verblijf staat niet meer in de labels — die zouden
        // naast elkaar niet passen — maar wel op de groep, zodat een schermlezer
        // nog steeds hoort wélk verblijf bedoeld wordt.
        <div
          role="group"
          aria-label={`Verblijf van deze dag: ${verblijf.name}`}
          className="flex flex-wrap gap-x-4"
        >
          {/* Het hele label is het raakvlak, niet alleen het vinkje: met een
              duim mik je op de regel. */}
          <label className="flex items-center gap-2 py-1 text-xs text-text-muted pointer-coarse:min-h-11 pointer-coarse:py-0">
            <input
              type="checkbox"
              checked={day.startAtStay}
              onChange={(event) =>
                userId && void saveDay(userId, { ...day, startAtStay: event.target.checked })
              }
              className="size-4"
            />
            Vertrek van verblijf
          </label>
          <label className="flex items-center gap-2 py-1 text-xs text-text-muted pointer-coarse:min-h-11 pointer-coarse:py-0">
            <input
              type="checkbox"
              checked={day.endAtStay}
              onChange={(event) =>
                userId && void saveDay(userId, { ...day, endAtStay: event.target.checked })
              }
              className="size-4"
            />
            Eindig bij verblijf
          </label>
        </div>
      )}

      {mapPick && (
        <p
          role="status"
          className="rounded-md border border-danger bg-surface-raised px-3 py-2 text-xs text-text-muted"
        >
          {mapPick.mode === "verplaatsen"
            ? "Klik op de kaart om de nieuwe plek te kiezen. Escape annuleert."
            : "Klik op de kaart om de plek te kiezen. Escape annuleert."}
        </p>
      )}

      <div
        ref={setNodeRef}
        className={`rounded-md transition-colors ${
          isOver ? "outline-2 outline-dashed outline-secondary" : ""
        }`}
      >
        {activities.length === 0 ? (
          <p className="text-sm text-text-subtle">
            Nog niets gepland. Voeg hieronder een dagdeel toe of sleep er een
            favoriet heen.
          </p>
        ) : (
          <SortableContext
            items={activities.map((activity) => activity.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="flex flex-col gap-2">
              {activities.map((activity) => {
                const index = placeIndex.get(activity.id);
                return (
                  <SortableActivity
                    key={activity.id}
                    activity={activity}
                    number={index === undefined ? null : index + 1}
                    // Het traject vanaf het vorige punt naar dit dagdeel.
                    leg={index === undefined ? undefined : route?.legs[index - 1 + legOffset]}
                    legZichtbaar={index !== undefined && (index > 0 || vanafVerblijf)}
                    routeLoading={routeStatus === "loading"}
                  />
                );
              })}
            </ol>
          </SortableContext>
        )}
      </div>

      {terugNaarVerblijf && (
        <p className="px-3 font-mono text-xs text-text-subtle">
          {`${legLabel(terugLeg, routeStatus === "loading")} · terug naar ${stay.favorite.name}`}
        </p>
      )}

      <ActivityForm dayId={day.id} userId={userId} />
    </div>
  );
}

/** "35 min · 12,4 km", of wat daar bij een ontbrekende route van te zeggen is. */
function legLabel(leg: RouteLeg | undefined, routeLoading: boolean): string {
  if (!leg) return routeLoading ? "route berekenen…" : "";
  return [
    leg.duration === null ? null : formatDuration(leg.duration),
    formatDistance(leg.distance),
    leg.duration === null ? "hemelsbreed" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function SortableActivity({
  activity,
  number,
  leg,
  legZichtbaar,
  routeLoading,
}: {
  activity: Activity;
  number: number | null;
  leg?: RouteLeg;
  legZichtbaar: boolean;
  routeLoading: boolean;
}) {
  const { user } = useSession();
  const setHoveredActivity = useTripStore((state) => state.setHoveredActivity);
  const hoveredActivityId = useTripStore((state) => state.hoveredActivityId);
  const deleteActivity = useTripStore((state) => state.deleteActivity);
  const selectedActivityId = useTripStore((state) => state.selectedActivityId);
  const setSelectedActivity = useTripStore((state) => state.setSelectedActivity);
  const setMobileTab = useTripStore((state) => state.setMobileTab);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: activity.id });

  // Verwijderen is niet terug te draaien en de knop staat vlak naast de greep
  // waarmee je sleept; met een duim scheelt dat weinig.
  const [vraagtVerwijderen, setVraagtVerwijderen] = useState(false);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onMouseEnter={() => setHoveredActivity(activity.id)}
      onMouseLeave={() => setHoveredActivity(null)}
      className={isDragging ? "z-10" : undefined}
    >
      {legZichtbaar && (
        <p className="px-3 py-1 font-mono text-xs text-text-subtle">
          {legLabel(leg, routeLoading)}
        </p>
      )}

      <div
        className={`flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
          isDragging
            ? "border-secondary bg-surface shadow-md"
            : hoveredActivityId === activity.id
              ? "border-secondary bg-surface-raised"
              : "border-border bg-surface"
        }`}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`${activity.title} verslepen`}
          // Het bolletje blijft klein — het is ook het nummer op de kaart —
          // maar krijgt op een aanraakscherm 44px raakvlak eromheen.
          className={`relative flex size-6 shrink-0 cursor-grab items-center justify-center rounded-full text-xs font-semibold active:cursor-grabbing pointer-coarse:before:absolute pointer-coarse:before:-inset-2.5 ${
            number === null
              ? "border border-border-strong text-text-subtle"
              : "bg-primary text-on-primary"
          }`}
        >
          {number ?? "·"}
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedActivity(activity.id);
            // Op mobiel is het dagdeel een eigen tabblad; ga er meteen heen.
            setMobileTab("dagdeel");
          }}
          aria-current={selectedActivityId === activity.id ? "true" : undefined}
          className="flex min-w-0 flex-1 flex-col justify-center rounded-sm text-left pointer-coarse:min-h-11"
        >
          <span className="flex items-baseline gap-2">
            <span className="shrink-0 font-mono text-xs text-text-muted">
              {activity.time || "—"}
            </span>
            <span
              className={`truncate text-sm hover:underline ${
                selectedActivityId === activity.id ? "font-semibold" : ""
              }`}
            >
              {activity.title}
            </span>
          </span>
          {activity.location && (
            <span className="truncate text-xs text-text-subtle">
              {activity.location.name}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setVraagtVerwijderen(true)}
          aria-label={`${activity.title} verwijderen`}
          className="relative flex shrink-0 items-center rounded-sm px-1 text-text-subtle hover:text-danger pointer-coarse:before:absolute pointer-coarse:before:-inset-3"
        >
          <TrashIcon className="size-3.5" />
        </button>
      </div>

      {vraagtVerwijderen && (
        <ConfirmDialog
          title="Dagdeel verwijderen?"
          description={`${activity.title} verdwijnt uit deze dag, met de notitie en de plek op de kaart. Dit is niet terug te draaien.`}
          confirmLabel="Verwijderen"
          onCancel={() => setVraagtVerwijderen(false)}
          onConfirm={() => {
            setVraagtVerwijderen(false);
            if (user) void deleteActivity(user.id, activity.id);
          }}
        />
      )}
    </li>
  );
}

/**
 * Nieuw dagdeel: alleen tijd en titel. De plek op de kaart zet je in het
 * dagdeelpaneel, zodat er één plek is waar een locatie vandaan komt.
 */
function ActivityForm({ dayId, userId }: { dayId: string; userId?: string }) {
  const addActivity = useTripStore((state) => state.addActivity);

  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");

  const definitieveTitel = title.trim();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!userId || definitieveTitel.length === 0) return;

    await addActivity(userId, dayId, { time: time.trim(), title: definitieveTitel });
    setTime("");
    setTitle("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={time}
          onChange={(event) => setTime(event.target.value)}
          placeholder="09:00 - 11:00"
          aria-label="Tijd"
          className="w-32 shrink-0 rounded-md border border-border-strong bg-surface px-2 py-1.5 font-mono text-sm placeholder:font-sans placeholder:text-text-subtle pointer-coarse:min-h-11"
        />
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Wandelen"
          aria-label="Dagdeel"
          className="flex-1 rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm placeholder:text-text-subtle pointer-coarse:min-h-11"
        />
      </div>

      <button
        type="submit"
        disabled={definitieveTitel.length === 0}
        className="self-start rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:px-4"
      >
        Dagdeel toevoegen
      </button>
    </form>
  );
}

function DayNote({ day }: { day: Day }) {
  const { user } = useSession();
  const saveDay = useTripStore((state) => state.saveDay);
  const [html, setHtml] = useState(day.notes);

  useEffect(() => {
    if (html === day.notes) return;

    const timer = setTimeout(() => {
      if (user) void saveDay(user.id, { ...day, notes: html });
    }, 600);
    return () => clearTimeout(timer);
  }, [html, day, user, saveDay]);

  return <RichText value={day.notes} onChange={setHtml} />;
}
