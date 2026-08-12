/**
 * Label bij een knop die alleen een icoon heeft. Verschijnt bij hover en bij
 * toetsenbordfocus; de knop zelf houdt zijn `aria-label`, dus schermlezers
 * hebben deze tekst niet nodig.
 */
export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="group relative flex">
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-secondary px-2 py-1 text-xs text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
