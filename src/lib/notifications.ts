/**
 * Helpers pra criar notificações in-app.
 *
 * Tabela: membros.notifications (id, user_id, title, body, link, is_read, created_at)
 * RLS: aluno lê apenas as próprias.
 *
 * Escritas vêm sempre do server via service_role (silent-fail).
 */

import { createAdminClient } from "@/lib/supabase/server";

export interface NotifyParams {
  userId: string;
  title: string;
  body?: string | null;
  link?: string | null;
}

export async function tryNotify(params: NotifyParams): Promise<void> {
  try {
    if (!params.userId || !params.title) return;
    const supabase = createAdminClient();
    await supabase.schema("membros").from("notifications").insert({
      user_id: params.userId,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
    });
  } catch {
    // best-effort
  }
}

export async function tryNotifyMany(
  userIds: string[],
  payload: Omit<NotifyParams, "userId">,
): Promise<void> {
  try {
    if (userIds.length === 0 || !payload.title) return;
    const supabase = createAdminClient();
    await supabase
      .schema("membros")
      .from("notifications")
      .insert(
        userIds.map((userId) => ({
          user_id: userId,
          title: payload.title,
          body: payload.body ?? null,
          link: payload.link ?? null,
        })),
      );
  } catch {
    // best-effort
  }
}
