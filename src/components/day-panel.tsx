"use client";

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  restrictToHorizontalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth/session";
import { formatDayLabel } from "@/lib/dates";
import { useActiveDay, useTripStore } from "@/lib/store";
import type { Day } from "@/lib/types";
import { Collapsible } from "./collapsible";
import { DayPlan } from "./day-plan";
import { OfflineMapPanel } from "./offline-map-panel";
import { TripTransfer } from "./trip-transfer";

export function DayPanel() {
  const { user } = useSession();
  const trip = useTripStore((state) => state.data?.trip);
  const days = useTripStore((state) => state.data?.days);
  const activeDayId = useTripStore((state) => state.activeDayId);
  const setActiveDay = useTripStore((state) => state.setActiveDay);
  const addDay = useTripStore((state) => state.addDay);
  const reorderDays = useTripStore((state) => state.reorderDays);
  const activeDay = useActiveDay();

  const stripRef = useRef<HTMLUListElement>(null);
  const [randen, setRanden] = useState({ links: false, rechts: false });

  const meetRanden = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    setRanden({
      links: strip.scrollLeft > 1,
      rechts: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1,
    });
  }, []);

  // Opnieuw meten als de strip van maat verandert: een draai van het toestel of
  // het openklappen van het paneel op mobiel. `days` staat erbij omdat een dag
  // erbij de inhoud breder maakt zonder dat de strip zelf van maat verandert.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    const observer = new ResizeObserver(meetRanden);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [meetRanden, days]);

  // Muis: slepen na 4 pixels, zodat een klik nog een klik is. Touch: pas na
  // een korte druk, anders zou horizontaal scrollen door de strip meteen een
  // dag oppakken.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!user || !days || !over || active.id === over.id) return;

    const ids = days.map((day) => day.id);
    await reorderDays(
      user.id,
      arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))),
    );
  }

  if (!trip || !days) return null;

  return (
    <aside
      aria-label="Dagindeling"
      className="flex w-full flex-col border-t border-border bg-surface lg:w-[420px] lg:border-l lg:border-t-0"
    >
      {/*
        Op mobiel één regel: de reisnaam en de datums zijn context, geen kop van
        het scherm, en elke pixel hierboven gaat van de dagplanning af.
      */}
      <header className="flex items-baseline gap-2 bg-black px-6 py-2.5 lg:flex-col lg:items-start lg:py-4">
        {/* De reisnaam wijkt, niet de datums: die zijn kort en altijd even lang. */}
        <h1 className="truncate font-display text-lg font-semibold text-white">
          {trip.name}
        </h1>
        <p className="shrink-0 text-sm text-white/80 lg:mt-0.5">
          {formatDayLabel(trip.startDate)} – {formatDayLabel(trip.endDate)}
        </p>
      </header>

      {/*
        Beheer van de reis staat op een eigen band: het hoort niet bij de dag die
        je aan het plannen bent en mag daar dus ook niet zo uitzien. Dicht, want
        onderweg lees je de dagplanning en exporteer je niet.
      */}
      {/* De band draagt zelf de zware onderrand; de `Collapsible` erbinnen zou
          er zijn eigen 1px tegenaan zetten en dat leest als één rafelige lijn. */}
      <div className="border-y border-border bg-surface-raised border-b-3 px-6 [&>details]:border-b-0">
        <Collapsible title="Reis" hint="exporteren · offline kaart">
          <div className="flex flex-col gap-2">
            <TripTransfer />
            <OfflineMapPanel />
          </div>
        </Collapsible>
      </div>

      {/*
        De dagen zijn te verslepen: de datums van de reis blijven staan, de dag
        schuift er met zijn hele planning langs.
      */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <nav aria-label="Dagen" className="border-b border-border">
          <ul
            ref={stripRef}
            onScroll={meetRanden}
            // Een vervagende rand zegt dat er nog dagen buiten beeld staan.
            // Alleen aan de kant waar echt nog iets ligt: aan het einde van de
            // strip zou een vage "+"-knop juist verwarren.
            style={{
              maskImage: `linear-gradient(to right, ${
                randen.links ? "transparent" : "#000"
              } 0, #000 2rem, #000 calc(100% - 2rem), ${
                randen.rechts ? "transparent" : "#000"
              } 100%)`,
            }}
            className="flex items-stretch gap-2 overflow-x-auto px-6 py-3"
          >
            <li>
              <AddDayButton
                label="Dag ervoor toevoegen"
                onClick={() => user && void addDay(user.id, "voor")}
              />
            </li>
            <SortableContext
              items={days.map((day) => day.id)}
              strategy={horizontalListSortingStrategy}
            >
              {days.map((day, index) => (
                <SortableDay
                  key={day.id}
                  day={day}
                  number={index + 1}
                  active={day.id === activeDayId}
                  onSelect={() => setActiveDay(day.id)}
                />
              ))}
            </SortableContext>
            <li>
              <AddDayButton
                label="Dag erna toevoegen"
                onClick={() => user && void addDay(user.id, "na")}
              />
            </li>
          </ul>
        </nav>
      </DndContext>

      <div className="flex flex-1 flex-col overflow-y-auto px-6 py-4">
        {activeDay && <DayPlan key={activeDay.id} day={activeDay} />}
      </div>
    </aside>
  );
}

/**
 * Eén dag in de strip. Klikken kiest hem; slepen zet hem op een andere plek in
 * de reis. De sleepafstand van 4 pixels houdt die twee uit elkaar.
 */
function SortableDay({
  day,
  number,
  active,
  onSelect,
}: {
  day: Day;
  number: number;
  active: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: day.id });

  // De strip opent op de actieve dag. Op dag negen van de reis staat die anders
  // buiten beeld en moet je er eerst naartoe vegen.
  const eigenRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (active) eigenRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [active]);

  return (
    <li
      ref={(node) => {
        setNodeRef(node);
        eigenRef.current = node;
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "z-10" : undefined}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        // Slepen begint op touch pas na een kwart seconde drukken; zonder dit
        // duwtje bij het aanraken lijkt de strip in die tijd niet te reageren.
        className={`flex cursor-grab flex-col items-start whitespace-nowrap rounded-md border px-3 py-2 transition-colors active:scale-[0.97] active:cursor-grabbing ${
          active
            ? "border-secondary bg-primary text-on-primary"
            : "border-border hover:bg-surface-sunken"
        } ${isDragging ? "shadow-md" : ""}`}
      >
        <span className="text-xs font-medium uppercase tracking-wide opacity-70">
          Dag {number}
        </span>
        <span className="text-sm font-semibold">{formatDayLabel(day.date)}</span>
      </button>
    </li>
  );
}

function AddDayButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-full items-center justify-center rounded-md border border-dashed border-border px-3 text-lg text-text-muted transition-colors hover:bg-surface-sunken pointer-coarse:min-w-11"
    >
      +
    </button>
  );
}
