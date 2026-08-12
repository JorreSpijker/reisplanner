"use client";

/**
 * Uitklapbare sectie. Bijzaken van de dag staan standaard dicht, zodat de
 * dagplanning zelf in beeld blijft. De hint zegt wat erin zit zonder uitklappen.
 */
export function Collapsible({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-b border-border">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className="size-3 shrink-0 text-text-subtle transition-transform group-open:rotate-90"
        >
          <path
            d="M4 2l4 4-4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="flex-1">{title}</span>
        {hint && <span className="text-xs font-normal text-text-subtle">{hint}</span>}
      </summary>

      <div className="pb-4">{children}</div>
    </details>
  );
}
