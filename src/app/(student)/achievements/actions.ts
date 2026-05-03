"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sanitizePostHtml, userHasCommunityAccess } from "@/lib/community";
import { getUserRole } from "@/lib/access";

export type ActionResult<T = unknown> = {
  ok: boolean;
  error?: string;
  data?: T;
};

/**
 * Compartilha uma conquista desbloqueada na página /community/resultados.
 *
 * Cria um post auto-aprovado com o badge da conquista + texto opcional
 * do aluno. Só funciona se:
 *   - aluno tem conquista de fato desbloqueada
 *   - achievement.shareable = true (admin pode bloquear share)
 *   - aluno tem acesso à comunidade (has_community_access)
 *   - existe uma página com slug 'resultados' ativa
 *
 * Retorna o pageSlug + postId pra UI redirecionar pro post.
 */
export async function shareAchievementAction(params: {
  achievementId: string;
  message: string;
}): Promise<ActionResult<{ pageSlug: string; postId: string }>> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado." };

    const role = await getUserRole(supabase, user.id);
    const hasAccess = await userHasCommunityAccess(supabase, user.id, role);
    if (!hasAccess) {
      return {
        ok: false,
        error: "Você não tem acesso à comunidade pra compartilhar.",
      };
    }

    const admin = createAdminClient();

    // 1. Verifica que aluno tem essa conquista
    const { data: ua } = await admin
      .schema("membros")
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", user.id)
      .eq("achievement_id", params.achievementId)
      .maybeSingle();
    if (!ua) {
      return { ok: false, error: "Conquista não desbloqueada." };
    }

    // 2. Pega achievement (precisa estar shareable)
    const { data: ach } = await admin
      .schema("membros")
      .from("achievements")
      .select("id, code, name, description, icon, shareable")
      .eq("id", params.achievementId)
      .maybeSingle();
    const a = ach as
      | {
          id: string;
          code: string;
          name: string;
          description: string | null;
          icon: string;
          shareable: boolean;
        }
      | null;
    if (!a) return { ok: false, error: "Conquista não encontrada." };
    if (!a.shareable) {
      return { ok: false, error: "Essa conquista não é compartilhável." };
    }

    // 3. Pega página /community/resultados
    const { data: page } = await admin
      .schema("membros")
      .from("community_pages")
      .select("id, slug")
      .eq("slug", "resultados")
      .eq("is_active", true)
      .maybeSingle();
    const p = page as { id: string; slug: string } | null;
    if (!p) {
      return {
        ok: false,
        error:
          'Página "resultados" não existe na comunidade. Admin precisa criar primeiro.',
      };
    }

    // 4. Monta HTML do post (badge + texto opcional)
    const userMessage = params.message?.trim() ?? "";
    const safeMessage = sanitizePostHtml(
      userMessage.replace(/\n/g, "<br>"),
    );

    const bodyHtml = `<div style="text-align:center;padding:24px 16px;background:linear-gradient(135deg,rgba(201,146,42,0.15),rgba(122,86,24,0.15));border-radius:12px;border:1px solid rgba(201,146,42,0.4);margin-bottom:16px;">
  <div style="font-size:64px;line-height:1;margin-bottom:8px;">${a.icon}</div>
  <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c9922a;">Conquista desbloqueada</p>
  <h2 style="margin:8px 0 4px;font-size:24px;font-weight:800;color:#f0f0f0;">${escapeHtml(a.name)}</h2>
  ${a.description ? `<p style="margin:0;font-size:14px;color:#b8b8b8;">${escapeHtml(a.description)}</p>` : ""}
</div>${userMessage ? `<p>${safeMessage}</p>` : ""}`;

    const title = `🎉 ${a.name}`;

    // 5. Insere o post como APROVADO direto
    const { data: topic, error: insErr } = await admin
      .schema("membros")
      .from("community_topics")
      .insert({
        page_id: p.id,
        user_id: user.id,
        title,
        content_html: bodyHtml,
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insErr || !topic) {
      return {
        ok: false,
        error: insErr?.message ?? "Falha ao criar post.",
      };
    }

    revalidatePath("/community", "layout");
    revalidatePath(`/community/${p.slug}`);
    return {
      ok: true,
      data: { pageSlug: p.slug, postId: (topic as { id: string }).id },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
