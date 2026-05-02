import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { timeAgoPtBr } from "@/lib/community";
import { MarkAllReadButton } from "@/components/student/mark-all-read-button";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .schema("membros")
    .from("notifications")
    .select("id, title, body, link, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const items = (data ?? []) as Array<{
    id: string;
    title: string;
    body: string | null;
    link: string | null;
    is_read: boolean;
    created_at: string;
  }>;

  const unread = items.filter((i) => !i.is_read).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
            <Bell className="h-3.5 w-3.5" />
            Notificações
          </div>
          <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
            Suas atualizações
          </h1>
          <p className="mt-1 text-sm text-npb-text-muted">
            {items.length === 0
              ? "Nada por aqui ainda."
              : unread > 0
                ? `${unread} não lida${unread > 1 ? "s" : ""} de ${items.length}`
                : `Todas as ${items.length} notificações já foram lidas.`}
          </p>
        </div>
        {unread > 0 && <MarkAllReadButton />}
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-10 text-center text-sm text-npb-text-muted">
          Quando algo acontecer (post aprovado, alguém responder seu comentário,
          conquista desbloqueada), você vai ver aqui.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const cls = n.is_read
              ? "border-npb-border bg-npb-bg2"
              : "border-npb-gold/40 bg-npb-gold/5";
            const inner = (
              <div className={`rounded-xl border p-4 transition ${cls}`}>
                <div className="flex items-start gap-3">
                  {!n.is_read && (
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-npb-gold" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-npb-text">
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 text-xs text-npb-text-muted">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-1.5 text-[11px] text-npb-text-muted">
                      {timeAgoPtBr(n.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link
                    href={n.link}
                    className="block transition hover:-translate-y-px"
                  >
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
  );
}
