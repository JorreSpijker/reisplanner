"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { useSession } from "@/lib/auth/session";
import { useActiveDayStay, useFavorites, useTripStore } from "@/lib/store";
import type { Day, Favorite } from "@/lib/types";
import { ConfirmDialog } from "./confirm-dialog";
import { HomeIcon } from "./home-icon";
import { PencilIcon } from "./pencil-icon";
import { TrashIcon } from "./trash-icon";

/**
 * Plekken die je vaker nodig hebt dan één dagdeel: het hotel, de supermarkt om
 * de hoek. Ze horen bij de reis, dus staan ze op elke dag; dagspecifiek is
 * alleen welke favoriet je verblijfplaats is.
 */
export function Favorites({ day }: { day: Day }) {
  const { user } = useSession();
  const favorites = useFavorites();
  const stay = useActiveDayStay();
  const mapPick = useTripStore((state) => state.mapPick);
  const setMapPick = useTripStore((state) => state.setMapPick);
  const setMobileTab = useTripStore((state) => state.setMobileTab);
  const deleteFavorite = useTripStore((state) => state.deleteFavorite);
  const saveFavorite = useTripStore((state) => state.saveFavorite);
  const setDayStay = useTripStore((state) => state.setDayStay);

  const kiest = mapPick?.mode === "favoriet";

  function handleNieuw() {
    if (kiest) {
      setMapPick(null);
      return;
    }
    setMapPick({ mode: "favoriet" });
    // Op mobiel staat de kaart in een eigen tabblad; daar valt pas iets te kiezen.
    setMobileTab("kaart");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleNieuw}
          aria-pressed={kiest}
          className={`shrink-0 rounded-md border px-2 py-1 text-xs transition-colors pointer-coarse:min-h-11 pointer-coarse:px-3 ${
            kiest
              ? "border-danger bg-surface-raised font-medium"
              : "border-border-strong hover:bg-surface-sunken"
          }`}
        >
          {kiest ? "Annuleren" : "+ Favoriet"}
        </button>
      </div>

      {favorites.length === 0 ? (
        <p className="text-sm text-text-subtle">
          Nog geen favorieten. Klik op “+ Favoriet” en wijs de plek aan op de
          kaart.
        </p>
      ) : (
        <>
          {/* Horizontaal scrollen: de strip mag de dagplanning niet wegdrukken. */}
          <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {favorites.map((favorite) => (
              <FavoriteCard
                key={favorite.id}
                favorite={favorite}
                isStay={stay?.id === favorite.id}
                onStay={() =>
                  user &&
                  void setDayStay(
                    user.id,
                    day.id,
                    stay?.id === favorite.id ? null : favorite.id,
                  )
                }
                onRename={(name) =>
                  user && void saveFavorite(user.id, { ...favorite, name })
                }
                onDelete={() => user && void deleteFavorite(user.id, favorite.id)}
              />
            ))}
          </ul>

          <p className="text-xs text-text-subtle">
            {stay
              ? `Sleep een favoriet in de dagplanning. Met het huisje kies je waar je die dag verblijft; nu is dat ${stay.name}.`
              : "Sleep een favoriet in de dagplanning. Met het huisje kies je waar je die dag verblijft."}
          </p>
        </>
      )}
    </div>
  );
}

function FavoriteCard({
  favorite,
  isStay,
  onStay,
  onRename,
  onDelete,
}: {
  favorite: Favorite;
  isStay: boolean;
  onStay: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `favoriet:${favorite.id}`,
    data: { type: "favoriet", favorite },
  });

  const [bewerkt, setBewerkt] = useState(false);
  const [naam, setNaam] = useState(favorite.name);
  // Een favoriet hangt aan de hele reis: hij weggooien raakt elke dag waar hij
  // de verblijfplaats is.
  const [vraagtVerwijderen, setVraagtVerwijderen] = useState(false);

  function bewaar() {
    setBewerkt(false);
    const nieuw = naam.trim();
    // Een lege naam maakt de kaart onleesbaar; dan terug naar de oude.
    if (nieuw.length === 0 || nieuw === favorite.name) {
      setNaam(favorite.name);
      return;
    }
    onRename(nieuw);
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`flex shrink-0 items-center gap-1 rounded-md border bg-surface px-2 py-1.5 ${
        isDragging ? "z-10 border-secondary shadow-md" : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={onStay}
        aria-pressed={isStay}
        aria-label={`${favorite.name} als verblijfplaats van deze dag`}
        title="Verblijfplaats van deze dag"
        className={`flex shrink-0 items-center justify-center rounded-sm p-1 transition-colors pointer-coarse:size-11 ${
          isStay ? "text-primary" : "text-text-subtle hover:text-text"
        }`}
      >
        <HomeIcon />
      </button>

      {bewerkt ? (
        <input
          value={naam}
          autoFocus
          onChange={(event) => setNaam(event.target.value)}
          onBlur={bewaar}
          onKeyDown={(event) => {
            if (event.key === "Enter") bewaar();
            if (event.key === "Escape") {
              setNaam(favorite.name);
              setBewerkt(false);
            }
          }}
          aria-label={`Naam van ${favorite.name}`}
          className="w-32 rounded-sm border border-border-strong bg-surface px-1 text-sm"
        />
      ) : (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`${favorite.name} naar de dagplanning slepen`}
          className="cursor-grab whitespace-nowrap px-1 text-sm active:cursor-grabbing pointer-coarse:min-h-11"
        >
          {favorite.name}
        </button>
      )}

      <button
        type="button"
        onClick={() => setBewerkt(true)}
        aria-label={`${favorite.name} hernoemen`}
        title="Hernoemen"
        className="flex shrink-0 items-center justify-center rounded-sm p-1 text-text-subtle hover:text-text pointer-coarse:size-11"
      >
        <PencilIcon className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={() => setVraagtVerwijderen(true)}
        aria-label={`${favorite.name} uit favorieten verwijderen`}
        className="flex shrink-0 items-center justify-center rounded-sm px-1 text-text-subtle hover:text-danger pointer-coarse:size-11"
      >
        <TrashIcon className="size-3.5" />
      </button>

      {vraagtVerwijderen && (
        <ConfirmDialog
          title="Favoriet verwijderen?"
          description={`${favorite.name} verdwijnt uit de hele reis, ook als hij op een dag je verblijfplaats is. Dagdelen die je er al mee gemaakt hebt blijven staan.`}
          confirmLabel="Verwijderen"
          onCancel={() => setVraagtVerwijderen(false)}
          onConfirm={() => {
            setVraagtVerwijderen(false);
            onDelete();
          }}
        />
      )}
    </li>
  );
}
