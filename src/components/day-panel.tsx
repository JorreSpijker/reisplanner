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
import { useSession } from "@/lib/auth/session";
import { formatDayLabel } from "@/lib/dates";
import { useActiveDay, useTripStore } from "@/lib/store";
import type { Day } from "@/lib/types";
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
      <header className="px-6 py-4 bg-black">
        <h1 className="font-display text-lg font-semibold text-white">{trip.name}</h1>
        <p className="mt-0.5 text-sm text-white">
          {formatDayLabel(trip.startDate)} – {formatDayLabel(trip.endDate)}
        </p>
      </header>

      {/*
        Beheer van de reis staat op een eigen band: het hoort niet bij de dag die
        je aan het plannen bent en mag daar dus ook niet zo uitzien.
      */}
      <div className="flex flex-col gap-2 border-y border-border bg-surface-raised border-b-3 px-6 py-2.5">
        <TripTransfer />
        <OfflineMapPanel />
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
          <ul className="flex items-stretch gap-2 overflow-x-auto px-6 py-3">
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

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "z-10" : undefined}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={`flex cursor-grab flex-col items-start whitespace-nowrap rounded-md border px-3 py-2 transition-colors active:cursor-grabbing ${
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
      className="flex h-full items-center rounded-md border border-dashed border-border px-3 text-lg text-text-muted transition-colors hover:bg-surface-sunken"
    >
      +
    </button>
  );
}
