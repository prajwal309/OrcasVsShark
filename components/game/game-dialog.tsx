"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function GameDialog({
  title,
  onClose,
  children,
  className,
}: {
  title: string | null;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const open = title !== null;

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={className}
      aria-labelledby={titleId}
      onClose={() => {
        if (!dialog.current?.open) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" aria-label="Close dialog" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
