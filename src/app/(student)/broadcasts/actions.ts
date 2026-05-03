"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; error?: string };

/**
 * Aluno dispensa um banner — insere row em user_dismissed_broadcasts.
 * Idempotente (PK composta evita duplicar). Banner some pra ele em todas
 * as telas no próximo refresh (revalidate do layout).
 */
export async function dismissBroadcastBannerAction(
  broadcastId: string,
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado." };

    if (!broadcastId) {
      return { ok: false, error: "ID inválido." };
    }

    const { error } = await supabase
      .schema("membros")
      .from("user_dismissed_broadcasts")
      .upsert(
        {
          user_id: user.id,
          broadcast_id: broadcastId,
        },
        { onConflict: "user_id,broadcast_id" },
      );
    if (error) return { ok: false, error: error.message };

    // Revalida o layout do aluno pra remover o banner em todas as páginas
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
