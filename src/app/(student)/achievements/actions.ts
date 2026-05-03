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
      .select(
        "id, code, name, description, icon, shareable, celebration_image_url, unlocks_decoration_id, avatar_decorations(name, image_url)",
      )
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
          celebration_image_url: string | null;
          unlocks_decoration_id: string | null;
          avatar_decorations:
            | { name: string; image_url: string | null }
            | { name: string; image_url: string | null }[]
            | null;
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

    // Pega avatar do user pra montar a composição com frame
    const deco = Array.isArray(a.avatar_decorations)
      ? a.avatar_decorations[0]
      : a.avatar_decorations;
    const decoImageUrl = deco?.image_url ?? null;
    const decoName = deco?.name ?? null;

    let userAvatarUrl: string | null = null;
    if (decoImageUrl) {
      const { data: profileRow } = await admin
        .schema("membros")
        .from("users")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      userAvatarUrl =
        (profileRow as { avatar_url: string | null } | null)?.avatar_url ??
        null;
    }

    // Badge: prioridade frame (avatar+decoração) > imagem custom > emoji
    let badgeHtml: string;
    let labelHtml: string;
    if (decoImageUrl) {
      // Composição avatar (circular) + frame em PNG por cima
      const avatarSrc =
        userAvatarUrl ??
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23666'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
      badgeHtml = `<div style="position:relative;width:200px;height:200px;margin:0 auto 12px;">
  <img src="${avatarSrc}" alt="" style="position:absolute;top:14%;left:14%;width:72%;height:72%;border-radius:50%;object-fit:cover;background:#1e1e1e;" />
  <img src="${decoImageUrl}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;" />
</div>`;
      labelHtml = `<p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c9922a;">Novo frame desbloqueado${decoName ? ` — ${escapeHtml(decoName)}` : ""}</p>`;
    } else if (a.celebration_image_url) {
      badgeHtml = `<img src="${a.celebration_image_url}" alt="${escapeHtml(a.name)}" style="display:block;margin:0 auto 12px;width:200px;height:200px;border-radius:16px;object-fit:cover;" />`;
      labelHtml = `<p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c9922a;">Conquista desbloqueada</p>`;
    } else {
      badgeHtml = `<div style="font-size:64px;line-height:1;margin-bottom:8px;">${a.icon}</div>`;
      labelHtml = `<p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c9922a;">Conquista desbloqueada</p>`;
    }

    const bodyHtml = `<div style="text-align:center;padding:24px 16px;background:linear-gradient(135deg,rgba(201,146,42,0.15),rgba(122,86,24,0.15));border-radius:12px;border:1px solid rgba(201,146,42,0.4);margin-bottom:16px;">
  ${badgeHtml}
  ${labelHtml}
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
