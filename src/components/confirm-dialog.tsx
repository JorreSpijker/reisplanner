"use client";

import { useEffect, useRef } from "react";

/**
 * Bevestiging voor iets dat je niet terugdraait. Op `<dialog>`, zodat Escape,
 * focus en de achtergrond door de browser geregeld zijn.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        // Escape: zelf sluiten, zodat de aanroeper zijn eigen staat bijwerkt.
        event.preventDefault();
        onCancel();
      }}
      // Een klik naast het venster valt op het dialoog zelf.
      onClick={(event) => event.target === ref.current && onCancel()}
      className="m-auto w-[min(24rem,calc(100%-2rem))] rounded-lg border border-border bg-surface p-5 text-text shadow-lg backdrop:bg-black/40"
    >
      <h2 className="font-display text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-text-muted">{description}</p>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border-strong px-3 py-1.5 text-sm font-medium hover:bg-surface-sunken"
        >
          Annuleren
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-danger px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
