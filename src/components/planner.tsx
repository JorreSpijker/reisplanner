"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth/session";
import { formatDayLabel } from "@/lib/dates";
import { formatDistance, formatDuration } from "@/lib/route";
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

        {selectedActivity ? (
          <div
            className={`min-h-0 flex-1 lg:flex lg:flex-none ${
              mobileTab === "dagdeel" ? "flex" : "hidden"
            }`}
          >
            <ActivityPanel key={selectedActivity.id} activity={selectedActivity} />
          </div>
        ) : (
          // Op mobiel houdt het tabblad zijn plek en vertelt het wat je moet
          // doen; op desktop zou een lege derde kolom alleen ruimte kosten.
          <div
            className={`min-h-0 flex-1 lg:hidden ${
              mobileTab === "dagdeel" ? "flex" : "hidden"
            }`}
          >
            <GeenDagdeel />
          </div>
        )}
      </main>

      <DayContext />
      <MobileTabs />
    </div>
  );
}

function GeenDagdeel() {
  const setMobileTab = useTripStore((state) => state.setMobileTab);

  return (
    <section
      aria-label="Dagdeel"
      className="flex w-full flex-col items-start gap-3 border-t border-border bg-surface px-5 py-6"
    >
      <h2 className="font-display text-base font-semibold">Geen dagdeel open</h2>
      <p className="max-w-prose text-sm text-text-muted">
        Kies een dagdeel in de dagplanning of tik op een genummerde marker op de
        kaart. Hier zet je dan de plek, de track en de notitie.
      </p>
      <button
        type="button"
        onClick={() => setMobileTab("dag")}
        className="rounded-md border border-border-strong px-3 py-1.5 text-sm hover:bg-surface-sunken pointer-coarse:min-h-11"
      >
        Naar de dagplanning
      </button>
    </section>
  );
}

/**
 * Kort "opgeslagen" na elke wijziging. De titel, de tijd en de notities gaan
 * met vertraging naar de opslag; zonder teken weet je onderweg niet of je
 * wijziging vaststaat.
 *
 * Afgeleid van `data`: dat object wordt alleen vervangen als de repository
 * daadwerkelijk iets heeft weggeschreven.
 */
function useZojuistOpgeslagen(): boolean {
  const data = useTripStore((state) => state.data);
  const [zichtbaar, setZichtbaar] = useState(false);
  // De eerste `data` is het laden van de reis, niet een wijziging van jou.
  const geladen = useRef(false);

  useEffect(() => {
    if (!data) return;
    if (!geladen.current) {
      geladen.current = true;
      return;
    }

    setZichtbaar(true);
    const timer = setTimeout(() => setZichtbaar(false), 2000);
    return () => clearTimeout(timer);
  }, [data]);

  return zichtbaar;
}

/**
 * Welke dag je bekijkt, en wat die dag aan rijden kost. Staat buiten de panelen
 * omdat de kaart anders zonder bijschrift is: hij toont de punten van de actieve
 * dag, terwijl die keuze in een ander tabblad staat. De pijlen maken dit meteen
 * de dagnavigatie: op de kaart wilde je anders eerst terug naar de dagplanning.
 */
function DayContext() {
  const days = useTripStore((state) => state.data?.days);
  const activeDayId = useTripStore((state) => state.activeDayId);
  const setActiveDay = useTripStore((state) => state.setActiveDay);
  const route = useTripStore((state) => state.route);
  const routeStatus = useTripStore((state) => state.routeStatus);
  const opgeslagen = useZojuistOpgeslagen();

  const index = days?.findIndex((day) => day.id === activeDayId) ?? -1;
  if (!days || index === -1) return null;

  const afstand = route?.legs.reduce((som, leg) => som + leg.distance, 0) ?? 0;
  // Eén rechte lijn tussen twee punten maakt de optelsom van de rijtijd een
  // slag in de lucht; dan liever geen tijd dan een verkeerde.
  const duur = route?.legs.every((leg) => leg.duration !== null)
    ? route.legs.reduce((som, leg) => som + (leg.duration ?? 0), 0)
    : null;

  const delen = [
    `Dag ${index + 1}`,
    formatDayLabel(days[index].date),
    routeStatus === "loading" ? "route berekenen…" : null,
    duur === null ? null : formatDuration(duur),
    afstand > 0 ? formatDistance(afstand) : null,
  ].filter(Boolean);

  return (
    <div className="flex shrink-0 items-center border-t border-border bg-surface-raised pr-4 font-mono text-xs text-text-muted lg:hidden">
      <DagPijl
        richting="vorige"
        naar={days[index - 1]?.id}
        onKies={setActiveDay}
      />

      <p className="min-w-0 flex-1 truncate">{delen.join(" · ")}</p>

      {/* Achteraan en niet in de rij hierboven: op een smal scherm wordt die
          rij afgekapt, precies waar dit teken zou staan. */}
      {opgeslagen && <span className="shrink-0 pl-3 text-text">opgeslagen</span>}

      <DagPijl
        richting="volgende"
        naar={days[index + 1]?.id}
        onKies={setActiveDay}
      />
    </div>
  );
}

function DagPijl({
  richting,
  naar,
  onKies,
}: {
  richting: "vorige" | "volgende";
  naar: string | undefined;
  onKies: (dayId: string) => void;
}) {
  const vorige = richting === "vorige";

  // Aan het begin en het einde van de reis blijft de plek bezet: zou de pijl
  // verdwijnen, dan verspringt de regel eronder bij elke dagwissel.
  if (!naar) return <span aria-hidden="true" className="size-11 shrink-0" />;

  return (
    <button
      type="button"
      onClick={() => onKies(naar)}
      aria-label={`${vorige ? "Vorige" : "Volgende"} dag`}
      className="flex size-11 shrink-0 items-center justify-center text-text-subtle hover:text-text"
    >
      <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3.5">
        <path
          d={vorige ? "M8 2l-4 4 4 4" : "M4 2l4 4-4 4"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

const TABS = [
  { id: "dag" as const, label: "Dag" },
  { id: "kaart" as const, label: "Kaart" },
  { id: "dagdeel" as const, label: "Dagdeel" },
];

function MobileTabs() {
  const mobileTab = useTripStore((state) => state.mobileTab);
  const setMobileTab = useTripStore((state) => state.setMobileTab);

  return (
    <nav
      aria-label="Weergave"
      className="shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex">
        {/*
          Alle drie de tabbladen staan er altijd, en werken ook altijd. Ze
          weglaten zou "Dag" en "Kaart" verschuiven op het moment dat je een
          dagdeel opent, en ze uitzetten levert een knop op die er klikbaar
          uitziet en niets doet; zonder gekozen dagdeel vertelt het paneel zelf
          wat je moet doen.
        */}
        {TABS.map((tab) => {
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
