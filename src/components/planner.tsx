"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useSession } from "@/lib/auth/session";
import { useRouteSync, useSelectedActivity, useTripStore } from "@/lib/store";
import { TripSetup } from "./trip-setup";
import { DayPanel } from "./day-panel";
import { ActivityPanel } from "./activity-panel";

// MapLibre heeft `window` nodig en kan dus niet op de server renderen.
const MapView = dynamic(() => import("./map-view").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-surface-sunken">
      <p className="text-sm text-text-subtle">Kaart laden…</p>
    </div>
  ),
});

export function Planner() {
  const { user, status: sessionStatus } = useSession();
  const load = useTripStore((state) => state.load);
  const status = useTripStore((state) => state.status);
  const trip = useTripStore((state) => state.data?.trip);
  const selectedActivity = useSelectedActivity();
  const mobileTab = useTripStore((state) => state.mobileTab);

  useEffect(() => {
    if (user) void load(user.id);
  }, [user, load]);

  useRouteSync(user?.id);

  if (status === "error") {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm rounded-lg border border-danger px-5 py-4">
          <h1 className="font-display text-lg font-semibold">
            Je reis kon niet geladen worden
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            De opslag van de browser reageerde niet. Je gegevens zijn niet gewist.
            Sluit andere tabbladen van deze app en probeer het opnieuw.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover"
          >
            Opnieuw proberen
          </button>
        </div>
      </main>
    );
  }

  if (sessionStatus === "loading" || status !== "ready") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-subtle">Bezig met laden…</p>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <TripSetup />
      </main>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
        Op mobiel is één paneel tegelijk zichtbaar, gekozen met de tabbalk
        onderaan. De andere staan op `hidden` in plaats van dat ze verdwijnen:
        zo houdt de kaart zijn positie en zoomniveau bij het wisselen.
      */}
      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section
          aria-label="Kaart"
          className={`min-h-0 flex-1 bg-surface-sunken lg:block lg:flex-1 ${
            mobileTab === "kaart" ? "block" : "hidden"
          }`}
        >
          <MapView />
        </section>

        <div
          className={`min-h-0 flex-1 lg:flex lg:flex-none ${
            mobileTab === "dag" ? "flex" : "hidden"
          }`}
        >
          <DayPanel />
        </div>

        {selectedActivity && (
          <div
            className={`min-h-0 flex-1 lg:flex lg:flex-none ${
              mobileTab === "dagdeel" ? "flex" : "hidden"
            }`}
          >
            <ActivityPanel key={selectedActivity.id} activity={selectedActivity} />
          </div>
        )}
      </main>

      <MobileTabs hasActivity={Boolean(selectedActivity)} />
    </div>
  );
}

const TABS = [
  { id: "dag" as const, label: "Dag" },
  { id: "kaart" as const, label: "Kaart" },
  { id: "dagdeel" as const, label: "Dagdeel" },
];

function MobileTabs({ hasActivity }: { hasActivity: boolean }) {
  const mobileTab = useTripStore((state) => state.mobileTab);
  const setMobileTab = useTripStore((state) => state.setMobileTab);

  // Het Dagdeel-tabblad bestaat alleen zolang er een dagdeel open is.
  const tabs = hasActivity ? TABS : TABS.filter((tab) => tab.id !== "dagdeel");

  return (
    <nav
      aria-label="Weergave"
      className="shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex">
        {tabs.map((tab) => {
          const active = tab.id === mobileTab;
          return (
            <li key={tab.id} className="flex-1">
              <button
                type="button"
                onClick={() => setMobileTab(tab.id)}
                aria-current={active ? "page" : undefined}
                className={`w-full px-2 py-3 text-xs font-medium ${
                  active
                    ? "border-t-2 border-secondary text-text"
                    : "border-t-2 border-transparent text-text-subtle"
                }`}
              >
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
