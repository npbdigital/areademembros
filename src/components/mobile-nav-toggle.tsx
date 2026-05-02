"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";

interface Props {
  children: React.ReactNode;
  ariaLabel?: string;
}

/**
 * Botão hamburger + drawer (slide-in da esquerda) para sidebar mobile.
 * Renderiza children (a sidebar inteira) dentro de um portal.
 *
 * Visível só abaixo de md (768px) — em telas grandes a sidebar fica fixa.
 */
export function MobileNavToggle({ children, ariaLabel = "Menu" }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fecha em ESC e bloqueia scroll do body
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-npb-border bg-npb-bg3 text-npb-text transition hover:border-npb-gold"
      >
        <Menu className="h-4 w-4" />
      </button>

      {mounted && open &&
        createPortal(
          <div className="fixed inset-0 z-[60] md:hidden">
            {/* overlay */}
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/60"
            />
            {/* drawer — flex column com botão fechar embutido no topo */}
            <div
              className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-npb-sidebar shadow-2xl animate-in slide-in-from-left duration-200"
              onClick={(e) => {
                // fecha quando clica em qualquer link dentro
                const target = e.target as HTMLElement;
                if (target.closest("a")) setOpen(false);
              }}
            >
              <div className="flex items-center justify-end border-b border-[#2a2000] px-2 py-1.5">
                <button
                  type="button"
                  aria-label="Fechar menu"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-npb-text-muted transition-colors hover:bg-npb-bg3 hover:text-npb-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
