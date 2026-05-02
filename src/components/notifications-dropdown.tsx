"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, X } from "lucide-react";
import { timeAgoPtBr } from "@/lib/community";
import {
  deleteNotificationAction,
  markNotificationReadAction,
} from "@/app/(student)/notifications/actions";

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

  // Estado local pra optimistic updates (mark-as-read + dismiss)
  // Reseta quando os items vindos do server mudarem (após revalidate).
  const [local, setLocal] = useState<NotificationItem[]>(items);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  useEffect(() => {
    setLocal(items);
    setDismissed(new Set());
  }, [items]);

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

  const visible = local.filter((n) => !dismissed.has(n.id));
  const unreadCount = visible.filter((n) => !n.isRead).length;
  // Conta exibida no badge: usa contagem local quando há mudança optimistic
  const displayCount =
    visible.length === local.length && unreadCount === count
      ? count
      : unreadCount;
  const display = displayCount > 9 ? "9+" : String(displayCount);

  function markRead(id: string) {
    setLocal((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    void markNotificationReadAction(id);
  }

  function dismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    void deleteNotificationAction(id);
  }

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
        {displayCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-npb-gold px-1 text-[10px] font-bold leading-none text-black">
            {display}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="
            fixed right-2 top-14 z-50 w-[calc(100vw-1rem)] max-w-md
            sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-w-none
            overflow-hidden rounded-lg border border-npb-border bg-npb-bg2 shadow-xl
          "
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
            {visible.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-npb-text-muted">
                Nenhuma notificação.
              </div>
            ) : (
              <ul className="divide-y divide-npb-border">
                {visible.slice(0, 8).map((n) => (
                  <NotifRow
                    key={n.id}
                    n={n}
                    onClick={() => {
                      if (!n.isRead) markRead(n.id);
                      setOpen(false);
                    }}
                    onDismiss={() => dismiss(n.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifRow({
  n,
  onClick,
  onDismiss,
}: {
  n: NotificationItem;
  onClick: () => void;
  onDismiss: () => void;
}) {
  const [pendingDismiss, startDismiss] = useTransition();

  function handleDismissClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startDismiss(() => onDismiss());
  }

  const inner = (
    <div className="group relative flex items-start gap-2 px-4 py-3 transition hover:bg-npb-bg3">
      {!n.isRead && (
        <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-npb-gold" />
      )}
      <div className="min-w-0 flex-1 pr-5">
        <p
          className={`text-xs ${
            n.isRead ? "text-npb-text-muted" : "font-semibold text-npb-text"
          }`}
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
      <button
        type="button"
        onClick={handleDismissClick}
        disabled={pendingDismiss}
        title="Dispensar"
        aria-label="Dispensar"
        className="absolute right-2 top-2 rounded p-0.5 text-npb-text-muted opacity-0 transition hover:bg-npb-bg4 hover:text-red-400 group-hover:opacity-100 focus:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );

  return (
    <li>
      {n.link ? (
        <Link href={n.link} onClick={onClick}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className="block w-full text-left">
          {inner}
        </button>
      )}
    </li>
  );
}
