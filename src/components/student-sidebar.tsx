"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AtSign, Bookmark, Home, NotebookPen, Smile, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { NpbLogo } from "@/components/npb-logo";

const items = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/favorites", label: "Favoritos", icon: Bookmark },
  { href: "/notes", label: "Anotações", icon: NotebookPen },
  { href: "/community", label: "Comunidade", icon: Smile },
  { href: "/profile", label: "Perfil", icon: User },
  { href: "/support", label: "Suporte", icon: AtSign },
];

export function StudentSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 flex w-16 min-w-16 flex-col items-center bg-npb-sidebar border-r border-[#2a2000] py-4">
      <Link href="/dashboard" className="mb-7" aria-label="Academia NPB - Início">
        <NpbLogo size="sm" />
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={cn(
                "relative flex h-11 w-11 items-center justify-center rounded-[10px] transition-all",
                active
                  ? "bg-npb-gold/15 text-npb-gold"
                  : "text-npb-text-muted hover:bg-npb-gold/15 hover:text-npb-gold",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/4 bottom-1/4 w-[3px] rounded-r-[3px] bg-npb-gold"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
