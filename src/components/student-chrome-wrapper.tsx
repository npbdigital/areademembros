"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Props {
  sidebar: React.ReactNode;
  mainArea: React.ReactNode;
}

/**
 * Esconde a StudentSidebar do desktop e remove o padding equivalente do main
 * quando o usuário está em /community/*. Lá a CommunitySidebar ocupa o
 * espaço, evitando dois menus empilhados.
 *
 * No mobile, a StudentMobileNav já cuida disso (esconde o hamburger principal
 * em /community).
 */
export function StudentChromeWrapper({ sidebar, mainArea }: Props) {
  const pathname = usePathname();
  const isCommunity = pathname?.startsWith("/community") ?? false;

  return (
    <>
      <div className={cn("hidden", !isCommunity && "md:flex")}>{sidebar}</div>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          !isCommunity && "md:pl-60",
        )}
      >
        {mainArea}
      </div>
    </>
  );
}
