"use client";

import { formatDayLabel } from "@/lib/dates";
import { useActiveDay, useTripStore } from "@/lib/store";
import { DayPlan } from "./day-plan";
import { OfflineMapPanel } from "./offline-map-panel";
import { TripTransfer } from "./trip-transfer";

export function DayPanel() {
  const trip = useTripStore((state) => state.data?.trip);
  const days = useTripStore((state) => state.data?.days);
  const activeDayId = useTripStore((state) => state.activeDayId);
  const setActiveDay = useTripStore((state) => state.setActiveDay);
  const activeDay = useActiveDay();

  if (!trip || !days) return null;

  return (
    <aside
      aria-label="Dagindeling"
      className="flex w-full flex-col border-t border-border bg-surface lg:w-[420px] lg:border-l lg:border-t-0"
    >
      <header className="flex flex-col gap-3 border-b border-border px-6 py-4">
        <div>
          <h1 className="font-display text-lg font-semibold">{trip.name}</h1>
          <p className="text-sm text-text-muted">
            {formatDayLabel(trip.startDate)} – {formatDayLabel(trip.endDate)}
          </p>
        </div>
        <TripTransfer />
        <OfflineMapPanel />
      </header>

      <nav aria-label="Dagen" className="border-b border-border">
        <ul className="flex gap-2 overflow-x-auto px-6 py-3">
          {days.map((day, index) => {
            const active = day.id === activeDayId;
            return (
              <li key={day.id}>
                <button
                  type="button"
                  onClick={() => setActiveDay(day.id)}
                  aria-current={active ? "true" : undefined}
                  className={`flex flex-col items-start whitespace-nowrap rounded-md border px-3 py-2 transition-colors ${
                    active
                      ? "border-secondary bg-primary text-on-primary"
                      : "border-border hover:bg-surface-sunken"
                  }`}
                >
                  <span className="text-xs font-medium uppercase tracking-wide opacity-70">
                    Dag {index + 1}
                  </span>
                  <span className="text-sm font-semibold">
                    {formatDayLabel(day.date)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-1 flex-col overflow-y-auto px-6 py-4">
        {activeDay && <DayPlan key={activeDay.id} day={activeDay} />}
      </div>
    </aside>
  );
}
