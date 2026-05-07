"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AtSign,
  Bell,
  Bookmark,
  Home,
  NotebookPen,
  Radio,
  Smile,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NpbLogo } from "@/components/npb-logo";
import { PwaInstallButton } from "@/components/pwa-install-button";

const items = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/favorites", label: "Favoritos", icon: Bookmark },
  { href: "/notes", label: "Anotações", icon: NotebookPen },
  { href: "/community", label: "Comunidade", icon: Smile },
  { href: "/monitorias", label: "Monitorias ao vivo", icon: Radio },
  { href: "/notifications", label: "Notificações", icon: Bell },
  { href: "/profile", label: "Perfil", icon: User },
];

export function StudentSidebar({
  platformName = "Academia NPB",
  platformLogoUrl = null,
  socialInstagramUrl = null,
  socialYoutubeUrl = null,
}: {
  platformName?: string;
  platformLogoUrl?: string | null;
  socialInstagramUrl?: string | null;
  socialYoutubeUrl?: string | null;
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

          {/* Redes sociais — so renderiza se admin configurou em /admin/settings */}
          {(socialInstagramUrl || socialYoutubeUrl) && (
            <>
              <div
                aria-hidden
                className="my-2 border-t border-[#2a2000]/60"
              />
              {socialInstagramUrl && (
                <a
                  href={socialInstagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-npb-text-muted transition-colors hover:bg-npb-bg3 hover:text-npb-text"
                >
                  <InstagramIcon />
                  <span className="truncate">Instagram</span>
                </a>
              )}
              {socialYoutubeUrl && (
                <a
                  href={socialYoutubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-npb-text-muted transition-colors hover:bg-npb-bg3 hover:text-npb-text"
                >
                  <YoutubeIcon />
                  <span className="truncate">YouTube</span>
                </a>
              )}
            </>
          )}
        </div>
      </nav>
    </aside>
  );
}

// Inline SVGs — lucide-react@1.14 (versao do projeto) nao tem icones de marca.
function InstagramIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden
    >
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </svg>
  );
}
