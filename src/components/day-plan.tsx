"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
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
import { useActiveDayPlaces, useDayActivities, useTripStore } from "@/lib/store";
import type { Activity, Day } from "@/lib/types";
import { MapPinIcon } from "./map-pin-icon";
import { PlaceSearch } from "./place-search";
import { RichText } from "./rich-text";

/**
 * De planning van de dag: dagdelen en een notitie. Dit is de enige plek waar je
 * de dag indeelt. Een dagdeel met locatie verschijnt met hetzelfde nummer als
 * marker op de kaart en telt mee voor de route; een dagdeel zonder locatie
 * staat alleen in deze lijst.
 */
export function DayPlan({ day }: { day: Day }) {
  const { user } = useSession();

  return (
    <section className="flex flex-col gap-5">
      <Planning dayId={day.id} userId={user?.id} />

      <div className="flex flex-col gap-1.5 border-t border-border pt-4">
        <h3 className="text-sm font-medium">Notitie bij deze dag</h3>
        <DayNote day={day} />
      </div>
    </section>
  );
}

function Planning({ dayId, userId }: { dayId: string; userId?: string }) {
  const activities = useDayActivities(dayId);
  const places = useActiveDayPlaces();
  const reorderActivities = useTripStore((state) => state.reorderActivities);
  const mapPick = useTripStore((state) => state.mapPick);
  const route = useTripStore((state) => state.route);
  const routeStatus = useTripStore((state) => state.routeStatus);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Het nummer op de kaart telt alleen de dagdelen mét locatie, zodat de
  // markers op de kaart en de nummers in deze lijst gelijk lopen.
  const placeIndex = new Map(places.map((place, index) => [place.id, index]));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!userId || !over || active.id === over.id) return;

    const ids = activities.map((activity) => activity.id);
    const next = arrayMove(
      ids,
      ids.indexOf(String(active.id)),
      ids.indexOf(String(over.id)),
    );
    await reorderActivities(userId, dayId, next);
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Dagplanning</h2>

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

      {activities.length === 0 ? (
        <p className="text-sm text-text-subtle">
          Nog niets gepland. Voeg hieronder een dagdeel toe, met of zonder plek
          op de kaart.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
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
                    // Leg `index - 1` is het traject vanaf de vorige plek hierheen.
                    leg={index !== undefined && index > 0 ? route?.legs[index - 1] : undefined}
                    routeLoading={routeStatus === "loading"}
                  />
                );
              })}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <ActivityForm dayId={dayId} userId={userId} />
    </div>
  );
}

function SortableActivity({
  activity,
  number,
  leg,
  routeLoading,
}: {
  activity: Activity;
  number: number | null;
  leg?: RouteLeg;
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

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onMouseEnter={() => setHoveredActivity(activity.id)}
      onMouseLeave={() => setHoveredActivity(null)}
      className={isDragging ? "z-10" : undefined}
    >
      {number !== null && number > 1 && (
        <p className="px-3 py-1 font-mono text-xs text-text-subtle">
          {routeLoading && !leg
            ? "route berekenen…"
            : leg
              ? [
                  leg.duration === null ? null : formatDuration(leg.duration),
                  formatDistance(leg.distance),
                  leg.duration === null ? "hemelsbreed" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : null}
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
          className={`flex size-6 shrink-0 cursor-grab items-center justify-center rounded-full text-xs font-semibold active:cursor-grabbing ${
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
          className="flex min-w-0 flex-1 flex-col rounded-sm text-left"
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
          onClick={() => user && deleteActivity(user.id, activity.id)}
          aria-label={`${activity.title} verwijderen`}
          className="rounded-sm px-1.5 text-sm text-text-subtle hover:text-danger"
        >
          ×
        </button>
      </div>
    </li>
  );
}

function ActivityForm({ dayId, userId }: { dayId: string; userId?: string }) {
  const addActivity = useTripStore((state) => state.addActivity);
  const mapPick = useTripStore((state) => state.mapPick);
  const setMapPick = useTripStore((state) => state.setMapPick);
  // De locatie staat in de store: zowel het zoekveld hieronder als een klik op
  // de kaart vult hem, en de kaart kent dit formulier niet.
  const location = useTripStore((state) => state.draftLocation);
  const setLocation = useTripStore((state) => state.setDraftLocation);
  const setMobileTab = useTripStore((state) => state.setMobileTab);

  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");

  const kiest = mapPick?.mode === "nieuw";
  // Zonder eigen titel is de naam van de plek de titel.
  const definitieveTitel = title.trim() || location?.name || "";

  function handleKies() {
    if (kiest) {
      setMapPick(null);
      return;
    }
    setMapPick({ mode: "nieuw" });
    // Op mobiel staat de kaart in een eigen tabblad; daar valt pas iets te kiezen.
    setMobileTab("kaart");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!userId || definitieveTitel.length === 0) return;

    await addActivity(userId, dayId, {
      time: time.trim(),
      title: definitieveTitel,
      location,
    });
    setTime("");
    setTitle("");
    setLocation(null);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={time}
          onChange={(event) => setTime(event.target.value)}
          placeholder="09:00 - 11:00"
          aria-label="Tijd"
          className="w-32 shrink-0 rounded-md border border-border-strong bg-surface px-2 py-1.5 font-mono text-sm placeholder:font-sans placeholder:text-text-subtle"
        />
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          // Met een gekozen plek is de titel optioneel: die plek is de titel.
          placeholder={location ? location.name : "Wandelen"}
          aria-label="Dagdeel"
          className="flex-1 rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm placeholder:text-text-subtle"
        />
      </div>

      {location ? (
        <p className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <MapPinIcon className="size-4 shrink-0 text-text-subtle" />
          <span className="min-w-0 flex-1 truncate">{location.name}</span>
          <button
            type="button"
            onClick={() => setLocation(null)}
            aria-label="Locatie loslaten"
            className="rounded-sm px-1 text-text-subtle hover:text-danger"
          >
            ×
          </button>
        </p>
      ) : (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <PlaceSearch
              label="Locatie (optioneel)"
              placeholder="Zoek een plek"
              onPick={(place) =>
                setLocation({ name: place.name, lat: place.lat, lng: place.lng })
              }
            />
          </div>
          <button
            type="button"
            onClick={handleKies}
            aria-pressed={kiest}
            className={`flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
              kiest
                ? "border-danger bg-surface-raised font-medium"
                : "border-border-strong hover:bg-surface-sunken"
            }`}
          >
            <MapPinIcon />
            {kiest ? "Annuleren" : "Kies op kaart"}
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={definitieveTitel.length === 0}
        className="self-start rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
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
