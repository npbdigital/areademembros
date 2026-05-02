import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MarkAllReadButton } from "@/components/student/mark-all-read-button";
import {
  NotificationsList,
  type NotificationRow,
} from "@/components/student/notifications-list";

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

  const items = (data ?? []) as NotificationRow[];

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

      <NotificationsList initialItems={items} />
    </div>
  );
}
