"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AtSign, Bell, Bookmark, Home, NotebookPen, Smile, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { NpbLogo } from "@/components/npb-logo";
import { PwaInstallButton } from "@/components/pwa-install-button";

const items = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/favorites", label: "Favoritos", icon: Bookmark },
  { href: "/notes", label: "Anotações", icon: NotebookPen },
  { href: "/community", label: "Comunidade", icon: Smile },
  { href: "/notifications", label: "Notificações", icon: Bell },
  { href: "/profile", label: "Perfil", icon: User },
];

export function StudentSidebar({
  platformName = "Academia NPB",
  platformLogoUrl = null,
}: {
  platformName?: string;
  platformLogoUrl?: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "z-40 flex w-60 min-w-60 flex-col bg-npb-sidebar border-r border-[#2a2000]",
        // Mobile: dentro do drawer (h-full). Desktop: fixa lateral.
        "h-full md:fixed md:left-0 md:top-0 md:bottom-0",
      )}
    >
      <Link
        href="/dashboard"
        className="flex h-14 items-center gap-2.5 border-b border-[#2a2000] px-4"
        aria-label={`${platformName} - Início`}
      >
        <NpbLogo size="sm" name={platformName} logoUrl={platformLogoUrl} />
        <span className="truncate text-sm font-bold text-npb-text">
          {platformName}
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto npb-scrollbar p-3">
        <div className="flex flex-col gap-0.5">
          {items.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-npb-gold/15 text-npb-gold"
                    : "text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text",
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{label}</span>
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-[3px] bg-npb-gold"
                  />
                )}
              </Link>
            );
          })}
          <PwaInstallButton />
          <Link
            href="/support"
            className={cn(
              "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              pathname === "/support" || pathname.startsWith("/support/")
                ? "bg-npb-gold/15 text-npb-gold"
                : "text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text",
            )}
          >
            <AtSign className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">Suporte</span>
            {(pathname === "/support" || pathname.startsWith("/support/")) && (
              <span
                aria-hidden
                className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-[3px] bg-npb-gold"
              />
            )}
          </Link>
        </div>
      </nav>
    </aside>
  );
}
