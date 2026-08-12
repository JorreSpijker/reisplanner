"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth/session";
import { formatDayLabel } from "@/lib/dates";
import { useDayActivities, useTripStore } from "@/lib/store";
import type { Day } from "@/lib/types";

/**
 * Verhuist een deel van de dagplanning naar een andere dag. De selectie is per
 * dagdeel: onderweg schuift zelden een hele dag op, meestal blijft er iets
 * staan. Wat er op de doeldag staat blijft staan; de verhuizers komen erachter.
 */
export function MoveActivities({ day }: { day: Day }) {
  const { user } = useSession();
  const days = useTripStore((state) => state.data?.days);
  const moveActivities = useTripStore((state) => state.moveActivities);
  const activities = useDayActivities(day.id);

  const andereDagen = (days ?? []).filter((kandidaat) => kandidaat.id !== day.id);

  const [open, setOpen] = useState(false);
  const [targetDayId, setTargetDayId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [withNotes, setWithNotes] = useState(false);

  const doelActiviteiten = useDayActivities(targetDayId || null);
  const doelDag = andereDagen.find((kandidaat) => kandidaat.id === targetDayId);

  if (andereDagen.length === 0 || (activities.length === 0 && !day.notes)) return null;

  function openPanel() {
    // Bij elke keer openen weer de hele dag voorgeselecteerd; wie iets wil
    // laten staan vinkt dat uit.
    setSelected(activities.map((activity) => activity.id));
    setWithNotes(Boolean(day.notes));
    setTargetDayId(andereDagen[0].id);
    setOpen(true);
  }

  function toggle(activityId: string) {
    setSelected((huidig) =>
      huidig.includes(activityId)
        ? huidig.filter((id) => id !== activityId)
        : [...huidig, activityId],
    );
  }

  const botsingen = [
    doelActiviteiten.length > 0
      ? `${doelActiviteiten.length} ${doelActiviteiten.length === 1 ? "dagdeel" : "dagdelen"}`
      : null,
    withNotes && doelDag?.notes ? "een notitie" : null,
  ].filter(Boolean);

  const teVerplaatsen = selected.filter((id) =>
    activities.some((activity) => activity.id === id),
  );
  const kanVerplaatsen = teVerplaatsen.length > 0 || withNotes;

  async function handleMove() {
    if (!user || !kanVerplaatsen) return;
    await moveActivities(user.id, {
      sourceDayId: day.id,
      targetDayId,
      activityIds: teVerplaatsen,
      withNotes,
    });
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPanel}
        className="self-start rounded-md border border-border-strong px-3 py-1.5 text-sm hover:bg-surface-sunken pointer-coarse:min-h-11"
      >
        Verplaatsen naar andere dag
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-raised px-4 py-3">
      <h3 className="text-sm font-medium">Verplaatsen naar andere dag</h3>

      {activities.length > 0 && (
        <ul className="flex flex-col gap-1">
          {activities.map((activity) => (
            <li key={activity.id}>
              <label className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
                <input
                  type="checkbox"
                  checked={selected.includes(activity.id)}
                  onChange={() => toggle(activity.id)}
                  className="size-4"
                />
                <span className="shrink-0 font-mono text-xs text-text-muted">
                  {activity.time || "—"}
                </span>
                <span className="min-w-0 truncate">{activity.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {day.notes && (
        <label className="flex items-center gap-2 border-t border-border pt-2 text-sm pointer-coarse:min-h-11">
          <input
            type="checkbox"
            checked={withNotes}
            onChange={(event) => setWithNotes(event.target.checked)}
            className="size-4"
          />
          Notitie bij deze dag
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Naar
        <select
          value={targetDayId}
          onChange={(event) => setTargetDayId(event.target.value)}
          className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm pointer-coarse:min-h-11"
        >
          {andereDagen.map((kandidaat) => (
            <option key={kandidaat.id} value={kandidaat.id}>
              {`Dag ${(days ?? []).indexOf(kandidaat) + 1} · ${formatDayLabel(kandidaat.date)}`}
            </option>
          ))}
        </select>
      </label>

      {botsingen.length > 0 && (
        <p
          role="alert"
          className="rounded-md border border-danger px-3 py-2 text-xs text-text-muted"
        >
          {`Die dag heeft al ${botsingen.join(" en ")}. Wat je verplaatst komt erachter; er gaat niets verloren.`}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleMove}
          disabled={!kanVerplaatsen}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11"
        >
          {botsingen.length > 0 ? "Toch verplaatsen" : "Verplaatsen"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border-strong px-3 py-1.5 text-sm hover:bg-surface-sunken pointer-coarse:min-h-11"
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}
