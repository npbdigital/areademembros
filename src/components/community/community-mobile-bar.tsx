"use client";

import { usePathname } from "next/navigation";
import { Smile } from "lucide-react";
import { MobileNavToggle } from "@/components/mobile-nav-toggle";
import type { CommunityPageRow } from "@/lib/community";

interface Props {
  children: React.ReactNode;
  pages: CommunityPageRow[];
}

/**
 * Barra superior mobile-only da comunidade. Mostra "Comunidade · {página}" —
 * descobre a página pelo `usePathname` (`/community/[slug]`). O hamburger
 * abre a sidebar inteira (espaços + páginas + links + admin inline).
 *
 * Sumiço em md+ porque a sidebar fica fixa lá.
 */
export function CommunityMobileBar({ children, pages }: Props) {
  const pathname = usePathname() ?? "";
  let pageLabel = "";

  if (pathname === "/community" || pathname === "/community/") {
    pageLabel = "";
  } else if (pathname.startsWith("/community/feed")) {
    pageLabel = "Feed";
  } else {
    // /community/{slug} ou /community/{slug}/post/{id}
    const m = pathname.match(/^\/community\/([^/]+)/);
    if (m) {
      const slug = m[1];
      const page = pages.find((p) => p.slug === slug);
      pageLabel = page?.title ?? "";
    }
  }

  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-npb-border bg-npb-bg2 px-3 py-1.5 md:hidden">
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
  );
}
