"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Search, Smile } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  CommunityGalleryRow,
  CommunitySidebarLinkRow,
} from "@/lib/community";

interface Props {
  galleries: CommunityGalleryRow[];
  links: CommunitySidebarLinkRow[];
  /** map: gallery_id → count de posts não-lidos */
  unreadByGallery?: Record<string, number>;
}

export function CommunitySidebar({
  galleries,
  links,
  unreadByGallery = {},
}: Props) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  return (
    <aside className="hidden md:flex w-60 min-w-60 flex-col border-r border-npb-border bg-npb-bg2">
      <div className="border-b border-npb-border p-4">
        <div className="mb-3 flex items-center gap-2">
          <Smile className="h-5 w-5 text-npb-gold" />
          <h2 className="text-sm font-bold text-npb-text">Comunidade</h2>
        </div>
        <form
          action={query ? `/community/search?q=${encodeURIComponent(query)}` : undefined}
          className="relative"
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-npb-text-muted" />
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar"
            className="w-full rounded-md border border-npb-border bg-npb-bg3 py-1.5 pl-8 pr-3 text-xs text-npb-text outline-none placeholder:text-npb-text-muted/60 focus:border-npb-gold-dim"
          />
        </form>
      </div>

      <nav className="flex-1 overflow-y-auto npb-scrollbar p-3">
        <SectionLabel>Espaços</SectionLabel>
        {galleries.length === 0 ? (
          <p className="px-2 py-3 text-xs italic text-npb-text-muted">
            Nenhum espaço criado ainda.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {galleries.map((g) => {
              const href = g.slug ? `/community/${g.slug}` : "#";
              const active = g.slug
                ? pathname === href || pathname.startsWith(`${href}/`)
                : false;
              const unread = unreadByGallery[g.id] ?? 0;
              return (
                <Link
                  key={g.id}
                  href={href}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                    active
                      ? "bg-npb-gold/15 text-npb-gold"
                      : "text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text",
                  )}
                >
                  <span className="text-base leading-none">{g.icon ?? "💬"}</span>
                  <span className="flex-1 truncate">{g.title}</span>
                  {unread > 0 && (
                    <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {links.length > 0 && (
          <>
            <div className="my-4 border-t border-npb-border" />
            <SectionLabel>Atalhos</SectionLabel>
            <div className="flex flex-col gap-0.5">
              {links.map((l) => (
                <a
                  key={l.id}
                  href={l.url}
                  target={l.open_in_new_tab ? "_blank" : "_self"}
                  rel={l.open_in_new_tab ? "noopener noreferrer" : undefined}
                  className="group flex items-center gap-2 rounded-md px-2 py-2 text-sm text-npb-text-muted transition-colors hover:bg-npb-bg3 hover:text-npb-text"
                >
                  <span className="text-base leading-none">{l.icon ?? "🔗"}</span>
                  <span className="flex-1 truncate">{l.label}</span>
                  {l.open_in_new_tab && (
                    <ExternalLink className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                  )}
                </a>
              ))}
            </div>
          </>
        )}
      </nav>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-npb-text-muted">
      {children}
    </div>
  );
}
