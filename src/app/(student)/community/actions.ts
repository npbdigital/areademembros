"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getUserRole, isElevatedRole } from "@/lib/access";
import {
  sanitizePostHtml,
  userHasCommunityAccess,
} from "@/lib/community";
import { getPlatformSettings } from "@/lib/settings";
import { tryAwardXp } from "@/lib/gamification";
import { notifyAndEmail, tryNotify } from "@/lib/notifications";

export type ActionResult<T = unknown> = {
  ok: boolean;
  error?: string;
  data?: T;
};

async function requireUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");
  return user.id;
}

async function assertCommunityAccess(userId: string): Promise<void> {
  const supabase = createClient();
  const role = await getUserRole(supabase, userId);
  const ok = await userHasCommunityAccess(supabase, userId, role);
  if (!ok) throw new Error("Sem acesso à comunidade.");
}

// ============================================================
// CRIAR POST
// ============================================================
export async function createPostAction(
  _prev: ActionResult<{ topicId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ topicId: string }>> {
  try {
    const userId = await requireUserId();
    await assertCommunityAccess(userId);

    const pageId = String(formData.get("page_id") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const bodyHtml = String(formData.get("body") ?? "").trim();
    const videoUrl = String(formData.get("video_url") ?? "").trim() || null;
    const imageUrl = String(formData.get("image_url") ?? "").trim() || null;

    if (!pageId) return { ok: false, error: "Página inválida." };
    if (!title) return { ok: false, error: "Título é obrigatório." };
    if (title.length > 150)
      return { ok: false, error: "Título muito longo (máx. 150)." };
    if (bodyHtml.length > 50_000)
      return { ok: false, error: "Conteúdo muito longo." };

    const supabase = createClient();
    const role = await getUserRole(supabase, userId);
    // Admin/moderator sempre aprovado. Aluno: respeita setting auto_approve.
    const adminSb = createAdminClient();
    const settings = await getPlatformSettings(adminSb);
    const status =
      isElevatedRole(role) || settings.communityAutoApprove
        ? "approved"
        : "pending";

    const safeHtml = sanitizePostHtml(bodyHtml);

    const { data, error } = await supabase
      .schema("membros")
      .from("community_topics")
      .insert({
        page_id: pageId,
        user_id: userId,
        title,
        content_html: safeHtml,
        video_url: videoUrl,
        image_url: imageUrl,
        status,
        approved_by: status === "approved" ? userId : null,
        approved_at: status === "approved" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao criar post." };
    }

    // XP só sai se já entrou aprovado. Pra pendente, o XP é dado quando admin aprova.
    if (status === "approved" && settings.gamificationEnabled) {
      await tryAwardXp({
        userId,
        reason: "post_approved",
        amount: settings.xpPostApproved,
        referenceId: data.id,
      });
    }

    revalidatePath("/community", "layout");
    return { ok: true, data: { topicId: data.id } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

// ============================================================
// EDITAR POST (autor ou admin)
// ============================================================
export async function editPostAction(
  topicId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const supabase = createClient();
    const role = await getUserRole(supabase, userId);

    const title = String(formData.get("title") ?? "").trim();
    const bodyHtml = String(formData.get("body") ?? "").trim();
    const videoUrl = String(formData.get("video_url") ?? "").trim() || null;

    if (!title) return { ok: false, error: "Título é obrigatório." };
    if (title.length > 150)
      return { ok: false, error: "Título muito longo (máx. 150)." };
    if (bodyHtml.length > 50_000)
      return { ok: false, error: "Conteúdo muito longo." };

    // Verifica autoria via admin client (RLS bloquearia leitura cruzada)
    const adminSb = createAdminClient();
    const { data: existing } = await adminSb
      .schema("membros")
      .from("community_topics")
      .select("user_id, page_id")
      .eq("id", topicId)
      .maybeSingle();
    const t = existing as
      | { user_id: string; page_id: string }
      | null;
    if (!t) return { ok: false, error: "Post não encontrado." };
    if (t.user_id !== userId && !isElevatedRole(role)) {
      return { ok: false, error: "Sem permissão pra editar." };
    }

    const safeHtml = sanitizePostHtml(bodyHtml);
    const { error } = await adminSb
      .schema("membros")
      .from("community_topics")
      .update({
        title,
        content_html: safeHtml,
        video_url: videoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", topicId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

// ============================================================
// UPLOAD DE IMAGEM
// ============================================================
export async function uploadPostImageAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  try {
    const userId = await requireUserId();
    await assertCommunityAccess(userId);

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "Arquivo inválido." };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { ok: false, error: "Imagem maior que 10MB." };
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
      return { ok: false, error: "Formato não suportado." };
    }
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;

    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from("community-post-images")
      .upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
      });
    if (error) return { ok: false, error: error.message };

    const { data } = supabase.storage
      .from("community-post-images")
      .getPublicUrl(path);

    return { ok: true, data: { url: data.publicUrl } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

// ============================================================
// LIKE / UNLIKE
// ============================================================
export async function toggleTopicLikeAction(
  topicId: string,
): Promise<ActionResult<{ liked: boolean }>> {
  try {
    const userId = await requireUserId();
    await assertCommunityAccess(userId);
    const supabase = createClient();

    const { data: existing } = await supabase
      .schema("membros")
      .from("community_likes")
      .select("id")
      .eq("user_id", userId)
      .eq("topic_id", topicId)
      .maybeSingle();

    if (existing) {
      await supabase
        .schema("membros")
        .from("community_likes")
        .delete()
        .eq("id", existing.id);
      return { ok: true, data: { liked: false } };
    }

    await supabase.schema("membros").from("community_likes").insert({
      user_id: userId,
      topic_id: topicId,
    });

    // Notifica autor (best-effort, fire-and-forget)
    void notifyTopicAuthorOfLike(topicId, userId);

    return { ok: true, data: { liked: true } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

export async function toggleReplyLikeAction(
  replyId: string,
): Promise<ActionResult<{ liked: boolean }>> {
  try {
    const userId = await requireUserId();
    await assertCommunityAccess(userId);
    const supabase = createClient();

    const { data: existing } = await supabase
      .schema("membros")
      .from("community_likes")
      .select("id")
      .eq("user_id", userId)
      .eq("reply_id", replyId)
      .maybeSingle();

    if (existing) {
      await supabase
        .schema("membros")
        .from("community_likes")
        .delete()
        .eq("id", existing.id);
      return { ok: true, data: { liked: false } };
    }

    await supabase.schema("membros").from("community_likes").insert({
      user_id: userId,
      reply_id: replyId,
    });

    // Notifica autor do comentário (best-effort, fire-and-forget)
    void notifyReplyAuthorOfLike(replyId, userId);

    return { ok: true, data: { liked: true } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

/**
 * Helpers de notificação de like — separadas pra rodar em background sem
 * bloquear o retorno do toggle. Idempotentes via reference_id seria ideal,
 * mas como likes podem dar e tirar várias vezes, fica como notif "limite":
 * só notifica se o autor tem < 1 notif desse like nas últimas 24h pro mesmo
 * topic/reply (evita spam de like→unlike→like).
 */
async function notifyTopicAuthorOfLike(
  topicId: string,
  likerUserId: string,
): Promise<void> {
  try {
    const adminSb = createAdminClient();

    const [{ data: topicRow }, { data: likerRow }] = await Promise.all([
      adminSb
        .schema("membros")
        .from("community_topics")
        .select("user_id, title, page_id")
        .eq("id", topicId)
        .maybeSingle(),
      adminSb
        .schema("membros")
        .from("users")
        .select("full_name")
        .eq("id", likerUserId)
        .maybeSingle(),
    ]);

    const topic = topicRow as
      | { user_id: string; title: string; page_id: string }
      | null;
    if (!topic || topic.user_id === likerUserId) return;

    // Anti-spam: já notificou esse autor sobre likes no mesmo post nas últimas 24h?
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await adminSb
      .schema("membros")
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", topic.user_id)
      .ilike("title", "%curtiu%")
      .ilike("body", `%${topic.title.replace(/[%_]/g, "")}%`)
      .gte("created_at", since);
    if ((recentCount ?? 0) > 0) return;

    const { data: pageRow } = await adminSb
      .schema("membros")
      .from("community_pages")
      .select("slug")
      .eq("id", topic.page_id)
      .maybeSingle();
    const slug = (pageRow as { slug: string | null } | null)?.slug;
    const liker = (likerRow as { full_name: string | null } | null)?.full_name;

    await tryNotify({
      userId: topic.user_id,
      title: liker
        ? `${liker} curtiu seu post`
        : "Alguém curtiu seu post",
      body: `Em "${topic.title}"`,
      link: slug ? `/community/${slug}/post/${topicId}` : "/community",
    });
  } catch {
    // best-effort
  }
}

async function notifyReplyAuthorOfLike(
  replyId: string,
  likerUserId: string,
): Promise<void> {
  try {
    const adminSb = createAdminClient();

    const { data: replyRow } = await adminSb
      .schema("membros")
      .from("community_replies")
      .select("user_id, topic_id")
      .eq("id", replyId)
      .maybeSingle();
    const reply = replyRow as
      | { user_id: string; topic_id: string }
      | null;
    if (!reply || reply.user_id === likerUserId) return;

    // Anti-spam: já notificou nas últimas 24h pro mesmo comentário?
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await adminSb
      .schema("membros")
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", reply.user_id)
      .ilike("title", "%curtiu seu coment%")
      .gte("created_at", since);
    if ((recentCount ?? 0) > 0) return;

    const [{ data: topicRow }, { data: likerRow }] = await Promise.all([
      adminSb
        .schema("membros")
        .from("community_topics")
        .select("title, page_id")
        .eq("id", reply.topic_id)
        .maybeSingle(),
      adminSb
        .schema("membros")
        .from("users")
        .select("full_name")
        .eq("id", likerUserId)
        .maybeSingle(),
    ]);
    const topic = topicRow as
      | { title: string; page_id: string }
      | null;
    if (!topic) return;

    const { data: pageRow } = await adminSb
      .schema("membros")
      .from("community_pages")
      .select("slug")
      .eq("id", topic.page_id)
      .maybeSingle();
    const slug = (pageRow as { slug: string | null } | null)?.slug;
    const liker = (likerRow as { full_name: string | null } | null)?.full_name;

    await tryNotify({
      userId: reply.user_id,
      title: liker
        ? `${liker} curtiu seu comentário`
        : "Alguém curtiu seu comentário",
      body: `Em "${topic.title}"`,
      link: slug ? `/community/${slug}/post/${reply.topic_id}` : "/community",
    });
  } catch {
    // best-effort
  }
}

// ============================================================
// COMENTÁRIO
// ============================================================
export async function createReplyAction(
  topicId: string,
  parentId: string | null,
  bodyHtml: string,
): Promise<ActionResult<{ replyId: string; createdAt: string }>> {
  try {
    const userId = await requireUserId();
    await assertCommunityAccess(userId);

    const trimmed = bodyHtml.trim();
    if (!trimmed) return { ok: false, error: "Comentário vazio." };
    if (trimmed.length > 10_000)
      return { ok: false, error: "Comentário muito longo." };

    const supabase = createClient();
    const adminSb = createAdminClient();
    const safe = sanitizePostHtml(trimmed);

    // Insert + reads em paralelo — reduz latência total.
    const [insertRes, settings, topicRes, parentRes] = await Promise.all([
      supabase
        .schema("membros")
        .from("community_replies")
        .insert({
          topic_id: topicId,
          user_id: userId,
          content_html: safe,
          parent_id: parentId,
        })
        .select("id, created_at")
        .single(),
      getPlatformSettings(adminSb),
      adminSb
        .schema("membros")
        .from("community_topics")
        .select("user_id, title, page_id")
        .eq("id", topicId)
        .maybeSingle(),
      parentId
        ? adminSb
            .schema("membros")
            .from("community_replies")
            .select("user_id")
            .eq("id", parentId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (insertRes.error || !insertRes.data)
      return { ok: false, error: insertRes.error?.message ?? "Falha." };

    const reply = insertRes.data as { id: string; created_at: string };
    const topic = topicRes.data as
      | { user_id: string; title: string; page_id: string }
      | null;
    const parent = parentRes.data as { user_id: string } | null;

    // Busca slug + dispara XP/notificações em paralelo. Awaita pra não
    // morrer em serverless, mas não bloqueia retorno mais que necessário.
    const buildLink = async () => {
      if (!topic) return null;
      const { data: pageRow } = await adminSb
        .schema("membros")
        .from("community_pages")
        .select("slug")
        .eq("id", topic.page_id)
        .maybeSingle();
      const slug = (pageRow as { slug: string | null } | null)?.slug ?? null;
      return slug ? `/community/${slug}/post/${topicId}` : "/community";
    };

    const link = await buildLink();

    await Promise.allSettled([
      settings.gamificationEnabled
        ? tryAwardXp({
            userId,
            reason: "comment_approved",
            amount: settings.xpCommentApproved,
            referenceId: reply.id,
          })
        : Promise.resolve(),
      topic && topic.user_id !== userId
        ? notifyAndEmail({
            userId: topic.user_id,
            title: "Novo comentário no seu post",
            body: `Em "${topic.title}"`,
            link: link ?? "/community",
            ctaLabel: "Ver comentário",
          })
        : Promise.resolve(),
      parent && parent.user_id !== userId && parent.user_id !== topic?.user_id
        ? notifyAndEmail({
            userId: parent.user_id,
            title: "Alguém respondeu seu comentário",
            body: topic?.title ? `Em "${topic.title}"` : undefined,
            link: link ?? "/community",
            ctaLabel: "Ver resposta",
          })
        : Promise.resolve(),
    ]);

    revalidatePath(`/community/[slug]/post/${topicId}`, "page");
    return {
      ok: true,
      data: { replyId: reply.id, createdAt: reply.created_at },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

export async function deleteReplyAction(
  replyId: string,
): Promise<ActionResult> {
  try {
    await requireUserId();
    const supabase = createClient();
    // Próprio autor OU admin/moderator — RLS valida.
    const { error } = await supabase
      .schema("membros")
      .from("community_replies")
      .delete()
      .eq("id", replyId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

export async function deleteTopicAction(
  topicId: string,
  pageSlug: string,
): Promise<ActionResult> {
  try {
    await requireUserId();
    const supabase = createClient();
    const { error } = await supabase
      .schema("membros")
      .from("community_topics")
      .delete()
      .eq("id", topicId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/community/${pageSlug}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}
