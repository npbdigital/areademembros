"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Portal client-side que injeta children dentro de `#topbar-mobile-slot`
 * (renderizado pela Topbar). Usado por sub-layouts (ex: /community) pra
 * mostrar título de seção e botões contextuais sem criar uma segunda barra
 * empilhada.
 *
 * Aparece SÓ no mobile (parent tem md:hidden). Em desktop, o slot fica
 * vazio (`flex md:hidden`).
 *
 * SSR: renderiza nada até o componente montar (evita mismatch).
 */
export function TopbarMobileSlot({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById("topbar-mobile-slot");
    setTarget(el);
  }, []);

  if (!target) return null;
  return createPortal(children, target);
}
