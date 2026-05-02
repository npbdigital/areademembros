"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  GalleryHorizontal,
  LayoutDashboard,
  Layers,
  MessageCircle,
  PlaySquare,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NpbLogo } from "@/components/npb-logo";

const groups = [
  {
    label: "Visão geral",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { href: "/admin/courses", label: "Cursos", icon: BookOpen },
      { href: "/admin/banners", label: "Banners", icon: GalleryHorizontal },
      { href: "/admin/community", label: "Comunidade", icon: MessageCircle },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { href: "/admin/students", label: "Alunos", icon: Users },
      { href: "/admin/cohorts", label: "Turmas", icon: Layers },
    ],
  },
  {
    label: "Análises",
    items: [
      { href: "/admin/reports", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/youtube", label: "YouTube", icon: PlaySquare },
      { href: "/admin/settings", label: "Configurações", icon: Settings },
    ],
  },
];

export function AdminSidebar({
  platformName = "Academia NPB",
  platformLogoUrl = null,
}: {
  platformName?: string;
  platformLogoUrl?: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 flex w-60 min-w-60 flex-col bg-npb-sidebar border-r border-[#2a2000]">
      <div className="flex h-14 items-center px-4 border-b border-[#2a2000]">
        <Link href="/admin/dashboard" className="flex items-center gap-2.5">
          <NpbLogo size="sm" name={platformName} logoUrl={platformLogoUrl} />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-npb-text">{platformName}</span>
            <span className="text-[10px] uppercase tracking-widest text-npb-gold">
              Admin
            </span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto npb-scrollbar px-2 py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-npb-text-muted">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);
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
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[#2a2000] p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-npb-text-muted transition-colors hover:bg-npb-bg3 hover:text-npb-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a área do aluno
        </Link>
      </div>
    </aside>
  );
}
