/**
 * Bewaart één kaartbestand (PMTiles) op het toestel, zodat de kaart ook zonder
 * internet tegels heeft.
 *
 * Het bestand gaat naar OPFS en niet naar IndexedDB: het is tientallen
 * megabytes groot en MapLibre leest er kleine stukjes uit op. Een `File` uit
 * OPFS ondersteunt dat lezen per stuk; een blob in IndexedDB zou telkens in zijn
 * geheel in het geheugen komen.
 */

const BESTANDSNAAM = "kaart.pmtiles";

function beschikbaar(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.storage?.getDirectory);
}

export async function bewaarKaart(bestand: File): Promise<void> {
  const map = await navigator.storage.getDirectory();
  const handle = await map.getFileHandle(BESTANDSNAAM, { create: true });
  const schrijver = await handle.createWritable();
  await bestand.stream().pipeTo(schrijver);
}

export async function kaartBestand(): Promise<File | null> {
  if (!beschikbaar()) return null;

  try {
    const map = await navigator.storage.getDirectory();
    const handle = await map.getFileHandle(BESTANDSNAAM);
    return await handle.getFile();
  } catch {
    // Geen bestand opgeslagen; de kaart valt terug op de online tegels.
    return null;
  }
}

export async function verwijderKaart(): Promise<void> {
  const map = await navigator.storage.getDirectory();
  await map.removeEntry(BESTANDSNAAM).catch(() => {});
}

export function formatteerGrootte(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return mb >= 1024
    ? `${(mb / 1024).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} GB`
    : `${mb.toLocaleString("nl-NL", { maximumFractionDigits: 0 })} MB`;
}
