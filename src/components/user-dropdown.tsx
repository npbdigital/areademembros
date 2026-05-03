"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings, ShieldCheck, User } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

export interface UserDropdownProps {
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  decorationUrl?: string | null;
  isAdmin?: boolean;
  isModerator?: boolean;
}

export function UserDropdown({
  fullName,
  email,
  avatarUrl,
  decorationUrl,
  isAdmin,
  isModerator,
}: UserDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = getInitials(fullName || email);
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    fullName || email,
  )}&background=c9922a&color=fff&bold=true`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full p-0.5 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-npb-gold"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="relative h-[34px] w-[34px] flex-shrink-0">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={fullName}
              className="h-[34px] w-[34px] rounded-full border-2 border-npb-gold object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fallbackUrl}
              alt={initials}
              className="h-[34px] w-[34px] rounded-full border-2 border-npb-gold"
            />
          )}
          {decorationUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={decorationUrl}
              alt=""
              aria-hidden
              className="pointer-events-none absolute z-10 select-none"
              style={{
                width: 48,
                height: 48,
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                objectFit: "contain",
              }}
            />
          )}
        </div>
        <ChevronDown
          className={cn(
            "hidden h-3.5 w-3.5 text-npb-text-muted transition-transform md:block",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 overflow-hidden rounded-lg border border-npb-border bg-npb-bg2 shadow-xl"
        >
          <div className="border-b border-npb-border px-4 py-3">
            <div className="truncate text-sm font-semibold text-npb-text">
              {fullName || "Sem nome"}
            </div>
            <div className="truncate text-xs text-npb-text-muted">{email}</div>
            {isAdmin ? (
              <span className="mt-2 inline-flex items-center gap-1 rounded bg-npb-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-npb-gold">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </span>
            ) : isModerator ? (
              <span className="mt-2 inline-flex items-center gap-1 rounded bg-npb-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-npb-gold">
                <ShieldCheck className="h-3 w-3" />
                Moderador
              </span>
            ) : null}
          </div>

          <div className="py-1.5">
            <MenuLink
              href="/profile"
              icon={<User className="h-4 w-4" />}
              onClick={() => setOpen(false)}
            >
              Meu perfil
            </MenuLink>
            {isAdmin && (
              <MenuLink
                href="/admin/dashboard"
                icon={<Settings className="h-4 w-4" />}
                onClick={() => setOpen(false)}
              >
                Painel admin
              </MenuLink>
            )}
          </div>

          <form action={signOutAction} className="border-t border-npb-border">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-npb-text-muted transition-colors hover:bg-npb-bg3 hover:text-npb-text"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 text-sm text-npb-text-muted transition-colors hover:bg-npb-bg3 hover:text-npb-text"
    >
      {icon}
      {children}
    </Link>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
