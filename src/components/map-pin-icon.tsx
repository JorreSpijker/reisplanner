/** Speld op een kaart. Zit op de knoppen die een punt op de kaart laten kiezen. */
export function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? "size-4"}
    >
      <path d="M20 10c0 4.4-5.4 9.6-7.4 11.3a1 1 0 0 1-1.2 0C9.4 19.6 4 14.4 4 10a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
