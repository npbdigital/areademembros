"use client";

import { Smile } from "lucide-react";
import { MobileNavToggle } from "@/components/mobile-nav-toggle";

interface Props {
  children: React.ReactNode;
}

/**
 * Barra superior mobile-only da comunidade. Mostra o botão "Comunidade" que
 * abre a sidebar inteira (espaços + páginas + links + admin inline) num drawer.
 * Sumiço em md+ porque a sidebar fica fixa lá.
 */
export function CommunityMobileBar({ children }: Props) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-npb-border bg-npb-bg2 px-3 py-2 md:hidden">
      <MobileNavToggle ariaLabel="Abrir comunidade">{children}</MobileNavToggle>
      <div className="flex items-center gap-2 text-sm font-semibold text-npb-text">
        <Smile className="h-4 w-4 text-npb-gold" />
        Comunidade
      </div>
    </div>
  );
}
