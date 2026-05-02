"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import { timeAgoPtBr } from "@/lib/community";
import {
  deleteNotificationAction,
  markNotificationReadAction,
} from "@/app/(student)/notifications/actions";

export interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

interface Props {
  initialItems: NotificationRow[];
}

export function NotificationsList({ initialItems }: Props) {
  const [items, setItems] = useState<NotificationRow[]>(initialItems);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Reseta se a prop mudar (após revalidate)
  useEffect(() => {
    setItems(initialItems);
    setDismissed(new Set());
  }, [initialItems]);

  function markRead(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    void markNotificationReadAction(id);
  }

  function dismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    void deleteNotificationAction(id);
  }

  const visible = items.filter((n) => !dismissed.has(n.id));

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-10 text-center text-sm text-npb-text-muted">
        Quando algo acontecer (post aprovado, alguém responder seu comentário,
        conquista desbloqueada), você vai ver aqui.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {visible.map((n) => (
        <NotifRow
          key={n.id}
          n={n}
          onMarkRead={() => markRead(n.id)}
          onDismiss={() => dismiss(n.id)}
        />
      ))}
    </ul>
  );
}

function NotifRow({
  n,
  onMarkRead,
  onDismiss,
}: {
  n: NotificationRow;
  onMarkRead: () => void;
  onDismiss: () => void;
}) {
  const [pendingDismiss, startDismiss] = useTransition();

  function handleDismiss(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startDismiss(() => onDismiss());
  }

  function handleClick() {
    if (!n.is_read) onMarkRead();
  }

  const cls = n.is_read
    ? "border-npb-border bg-npb-bg2"
    : "border-npb-gold/40 bg-npb-gold/5";

  const inner = (
    <div className={`group relative rounded-xl border p-4 transition ${cls}`}>
      <div className="flex items-start gap-3">
        {!n.is_read && (
          <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-npb-gold" />
        )}
        <div className="min-w-0 flex-1 pr-6">
          <p className="text-sm font-semibold text-npb-text">{n.title}</p>
          {n.body && (
            <p className="mt-0.5 text-xs text-npb-text-muted">{n.body}</p>
          )}
          <p className="mt-1.5 text-[11px] text-npb-text-muted">
            {timeAgoPtBr(n.created_at)}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        disabled={pendingDismiss}
        title="Dispensar"
        aria-label="Dispensar"
        className="absolute right-2 top-2 rounded p-1 text-npb-text-muted opacity-0 transition hover:bg-npb-bg3 hover:text-red-400 group-hover:opacity-100 focus:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <li>
      {n.link ? (
        <Link
          href={n.link}
          onClick={handleClick}
          className="block transition hover:-translate-y-px"
        >
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="block w-full text-left transition hover:-translate-y-px"
        >
          {inner}
        </button>
      )}
    </li>
  );
}
