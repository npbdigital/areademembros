"use client";

import { usePathname } from "next/navigation";
import { Smile } from "lucide-react";
import { MobileNavToggle } from "@/components/mobile-nav-toggle";
import { TopbarMobileSlot } from "@/components/topbar-mobile-slot";
import type { CommunityPageRow } from "@/lib/community";

interface Props {
  children: React.ReactNode;
  pages: CommunityPageRow[];
}

/**
 * Mobile-only — injeta o "Comunidade · {página}" + botão hamburger pra
 * abrir a sidebar inteira DENTRO da Topbar (via portal pro slot
 * `#topbar-mobile-slot`). Resultado: 1 barra única no mobile em vez de 2
 * empilhadas.
 */
export function CommunityMobileBar({ children, pages }: Props) {
  const pathname = usePathname() ?? "";
  let pageLabel = "";

  if (pathname.startsWith("/community/feed")) {
    pageLabel = "Feed";
  } else if (pathname !== "/community" && pathname !== "/community/") {
    const m = pathname.match(/^\/community\/([^/]+)/);
    if (m) {
      const page = pages.find((p) => p.slug === m[1]);
      pageLabel = page?.title ?? "";
    }
  }

  return (
    <TopbarMobileSlot>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <MobileNavToggle ariaLabel="Abrir comunidade">{children}</MobileNavToggle>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold text-npb-text">
          <Smile className="h-4 w-4 flex-shrink-0 text-npb-gold" />
          <span className="truncate">
            Comunidade
            {pageLabel && (
              <>
                <span className="px-1.5 text-npb-text-muted">·</span>
                <span className="text-npb-gold">{pageLabel}</span>
              </>
            )}
          </span>
        </div>
      </div>
    </TopbarMobileSlot>
  );
}
