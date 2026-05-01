"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** width em classes Tailwind, default max-w-md */
  widthClassName?: string;
}

/**
 * Modal portal-based, com ESC e click fora pra fechar.
 * Não usa nenhuma lib pra ficar leve (~30 LOC úteis).
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  widthClassName = "max-w-md",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[10vh] backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`w-full ${widthClassName} rounded-2xl border border-npb-border bg-npb-bg2 shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-npb-border px-5 py-3">
          <h2 className="text-sm font-semibold text-npb-text">{title ?? ""}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-7 w-7 items-center justify-center rounded text-npb-text-muted transition-colors hover:bg-npb-bg3 hover:text-npb-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
