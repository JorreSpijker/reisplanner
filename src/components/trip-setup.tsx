"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth/session";
import { useTripStore } from "@/lib/store";
import { TripTransfer } from "./trip-transfer";

const today = new Date().toISOString().slice(0, 10);

export function TripSetup() {
  const { user } = useSession();
  const createTrip = useTripStore((state) => state.createTrip);

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [saving, setSaving] = useState(false);

  const invalidRange = endDate < startDate;
  const canSubmit = name.trim().length > 0 && !invalidRange && !saving;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !canSubmit) return;
    setSaving(true);
    await createTrip(user.id, { name: name.trim(), startDate, endDate });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-lg border border-border bg-surface p-6"
    >
      <h1 className="font-display text-xl font-semibold">Nieuwe reis</h1>
      <p className="mt-1 text-sm text-text-muted">
        De dagen worden afgeleid uit de reisdatums.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Naam</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Rondreis Italië"
            required
            className="rounded-md border border-border-strong px-3 py-2 text-base placeholder:text-text-subtle"
          />
        </label>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium">Van</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
              className="rounded-md border border-border-strong px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium">Tot en met</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
              required
              aria-invalid={invalidRange}
              className="rounded-md border border-border-strong px-3 py-2 text-base aria-invalid:border-danger"
            />
          </label>
        </div>

        {invalidRange && (
          <p role="alert" className="text-sm text-danger">
            Einddatum ligt voor de startdatum.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-6 w-full rounded-md bg-primary px-4 py-2.5 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Bezig…" : "Reis aanmaken"}
      </button>

      <div className="mt-6 border-t border-border pt-4">
        <p className="mb-2 text-sm text-text-muted">
          Al een reis gepland op een ander apparaat? Zet het geëxporteerde
          bestand hier terug.
        </p>
        <TripTransfer />
      </div>
    </form>
  );
}
