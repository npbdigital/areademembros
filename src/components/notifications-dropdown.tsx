"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { timeAgoPtBr } from "@/lib/community";

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsDropdownProps {
  count?: number;
  items?: NotificationItem[];
}

export function NotificationsDropdown({
  count = 0,
  items = [],
}: NotificationsDropdownProps) {
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

  const display = count > 9 ? "9+" : String(count);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-npb-text-muted transition-colors hover:bg-npb-bg3 hover:text-npb-text focus:outline-none focus-visible:ring-2 focus-visible:ring-npb-gold"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Notificações"
      >
        <Bell className="h-[18px] w-[18px]" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-npb-gold px-1 text-[10px] font-bold leading-none text-black">
            {display}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-80 overflow-hidden rounded-lg border border-npb-border bg-npb-bg2 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-npb-border px-4 py-3">
            <span className="text-sm font-semibold text-npb-text">
              Notificações
            </span>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-npb-gold hover:text-npb-gold-light"
            >
              Ver todas
            </Link>
          </div>
          <div className="max-h-80 overflow-y-auto npb-scrollbar">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-npb-text-muted">
                Nenhuma notificação.
              </div>
            ) : (
              <ul className="divide-y divide-npb-border">
                {items.slice(0, 8).map((n) => {
                  const inner = (
                    <div className="flex items-start gap-2 px-4 py-3 transition hover:bg-npb-bg3">
                      {!n.isRead && (
                        <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-npb-gold" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs ${n.isRead ? "text-npb-text-muted" : "font-semibold text-npb-text"}`}
                        >
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-npb-text-muted">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-1 text-[10px] text-npb-text-muted">
                          {timeAgoPtBr(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link href={n.link} onClick={() => setOpen(false)}>
                          {inner}
                        </Link>
                      ) : (
                        inner
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
