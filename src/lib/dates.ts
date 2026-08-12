/** Alle ISO-datums van `start` tot en met `end`, inclusief beide. */
export function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);

  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** Dezelfde datum, `days` dagen verschoven. Negatief schuift terug. */
export function shiftDate(date: string, days: number): string {
  const cursor = new Date(`${date}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor.toISOString().slice(0, 10);
}

/**
 * Vandaag als ISO-datum, in de tijdzone van het toestel. Niet via `toISOString`:
 * die rekent in UTC en zou in Nederland tussen middernacht en twee uur 's
 * nachts nog gisteren teruggeven.
 */
export function todayIso(): string {
  const nu = new Date();
  const maand = String(nu.getMonth() + 1).padStart(2, "0");
  const dag = String(nu.getDate()).padStart(2, "0");
  return `${nu.getFullYear()}-${maand}-${dag}`;
}

/** "ma 12 mei" — voor de dag-selector. */
export function formatDayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
