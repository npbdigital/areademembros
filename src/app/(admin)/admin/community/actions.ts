"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/community";
import { getPlatformSettings } from "@/lib/settings";
import { tryAwardXp } from "@/lib/gamification";
import { notifyAndEmail } from "@/lib/notifications";

export type ActionResult<T = unknown> = {
  ok: boolean;
  error?: string;
  data?: T;
};

async function assertAdmin(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");
  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin" && role !== "moderator") {
    throw new Error("Sem permissão.");
  }
  return user.id;
}

function admin() {
  return createAdminClient();
}

// ============================================================
// MODERAÇÃO DE POSTS
// ============================================================
export async function approvePostAction(
  topicId: string,
): Promise<ActionResult> {
  try {
    const userId = await assertAdmin();
    const sb = admin();

    const { data: topic } = await sb
      .schema("membros")
      .from("community_topics")
      .select("user_id, status, title, page_id")
      .eq("id", topicId)
      .maybeSingle();
    const t = topic as
      | { user_id: string; status: string; title: string; page_id: string }
      | null;

    const { error } = await sb
      .schema("membros")
      .from("community_topics")
      .update({
        status: "approved",
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", topicId);
    if (error) return { ok: false, error: error.message };

    if (t && t.status !== "approved") {
      const settings = await getPlatformSettings(sb);

      if (settings.gamificationEnabled) {
        await tryAwardXp({
          userId: t.user_id,
          reason: "post_approved",
          amount: settings.xpPostApproved,
          referenceId: topicId,
        });
      }

      // Notifica autor
      const { data: page } = await sb
        .schema("membros")
        .from("community_pages")
        .select("slug")
        .eq("id", t.page_id)
        .maybeSingle();
      const slug = (page as { slug: string | null } | null)?.slug;
      await notifyAndEmail({
        userId: t.user_id,
        title: "Sua publicação foi aprovada",
        body: `"${t.title}" já está visível na comunidade.`,
        link: slug ? `/community/${slug}/post/${topicId}` : `/community`,
        ctaLabel: "Ver post",
      });
    }

    revalidatePath("/admin/community");
    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function toggleTopicPinAction(
  topicId: string,
  pinned: boolean,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = admin();
    const { error } = await sb
      .schema("membros")
      .from("community_topics")
      .update({ is_pinned: pinned, updated_at: new Date().toISOString() })
      .eq("id", topicId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function rejectPostAction(
  topicId: string,
): Promise<ActionResult> {
  try {
    const userId = await assertAdmin();
    const sb = admin();

    const { data: topic } = await sb
      .schema("membros")
      .from("community_topics")
      .select("user_id, status, title")
      .eq("id", topicId)
      .maybeSingle();
    const t = topic as
      | { user_id: string; status: string; title: string }
      | null;

    const { error } = await sb
      .schema("membros")
      .from("community_topics")
      .update({
        status: "rejected",
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", topicId);
    if (error) return { ok: false, error: error.message };

    if (t && t.status !== "rejected") {
      await notifyAndEmail({
        userId: t.user_id,
        title: "Sua publicação foi recusada",
        body: `"${t.title}" não foi aprovada pela moderação.`,
        link: `/community`,
        ctaLabel: "Ir para a comunidade",
      });
    }

    revalidatePath("/admin/community");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

// ============================================================
// CRUD ESPAÇOS (grupos não-clicáveis)
// ============================================================
export async function createSpaceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { ok: false, error: "Nome é obrigatório." };

    const supabase = admin();
    const { data: maxRow } = await supabase
      .schema("membros")
      .from("community_spaces")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const next = ((maxRow?.position as number | undefined) ?? 0) + 1;

    const { error } = await supabase
      .schema("membros")
      .from("community_spaces")
      .insert({ title, position: next, is_active: true });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function updateSpaceAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { ok: false, error: "Nome é obrigatório." };

    const { error } = await admin()
      .schema("membros")
      .from("community_spaces")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Move um espaço pra cima ou pra baixo na ordem da sidebar. */
export async function moveSpaceAction(
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = admin();

    const { data: spaces } = await sb
      .schema("membros")
      .from("community_spaces")
      .select("id, position")
      .order("position", { ascending: true });
    const list = (spaces ?? []) as Array<{ id: string; position: number }>;

    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0) return { ok: false, error: "Espaço não encontrado." };
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= list.length) {
      return { ok: true }; // já está no extremo
    }

    const a = list[idx];
    const b = list[swapWith];
    await Promise.all([
      sb
        .schema("membros")
        .from("community_spaces")
        .update({ position: b.position })
        .eq("id", a.id),
      sb
        .schema("membros")
        .from("community_spaces")
        .update({ position: a.position })
        .eq("id", b.id),
    ]);

    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Move uma página dentro do espaço dela pra cima/baixo. */
export async function movePageAction(
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = admin();

    const { data: target } = await sb
      .schema("membros")
      .from("community_pages")
      .select("id, position, space_id")
      .eq("id", id)
      .maybeSingle();
    const t = target as { id: string; position: number; space_id: string | null } | null;
    if (!t) return { ok: false, error: "Página não encontrada." };

    const { data: siblings } = await sb
      .schema("membros")
      .from("community_pages")
      .select("id, position")
      .eq(t.space_id === null ? "id" : "space_id", t.space_id ?? t.id)
      .order("position", { ascending: true });
    const list = (siblings ?? []) as Array<{ id: string; position: number }>;

    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0) return { ok: false, error: "Página fora do espaço." };
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= list.length) return { ok: true };

    const a = list[idx];
    const b = list[swapWith];
    await Promise.all([
      sb
        .schema("membros")
        .from("community_pages")
        .update({ position: b.position })
        .eq("id", a.id),
      sb
        .schema("membros")
        .from("community_pages")
        .update({ position: a.position })
        .eq("id", b.id),
    ]);

    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Move um sidebar link pra cima/baixo. */
export async function moveSidebarLinkAction(
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = admin();
    const { data: links } = await sb
      .schema("membros")
      .from("community_sidebar_links")
      .select("id, position")
      .order("position", { ascending: true });
    const list = (links ?? []) as Array<{ id: string; position: number }>;
    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0) return { ok: false, error: "Link não encontrado." };
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= list.length) return { ok: true };
    const a = list[idx];
    const b = list[swapWith];
    await Promise.all([
      sb
        .schema("membros")
        .from("community_sidebar_links")
        .update({ position: b.position })
        .eq("id", a.id),
      sb
        .schema("membros")
        .from("community_sidebar_links")
        .update({ position: a.position })
        .eq("id", b.id),
    ]);
    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function deleteSpaceAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    // Soft check: se houver páginas, libera elas pra órfãs (set space_id = null)
    await admin()
      .schema("membros")
      .from("community_pages")
      .update({ space_id: null })
      .eq("space_id", id);

    const { error } = await admin()
      .schema("membros")
      .from("community_spaces")
      .delete()
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

// ============================================================
// CRUD PÁGINAS (são as que abrem feed, dentro de um espaço)
// ============================================================
export async function createPageAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const spaceId = String(formData.get("space_id") ?? "").trim() || null;
    const title = String(formData.get("title") ?? "").trim();
    const icon = String(formData.get("icon") ?? "").trim() || "💬";
    const slug = slugify(String(formData.get("slug") ?? "").trim() || title);

    if (!title) return { ok: false, error: "Nome é obrigatório." };
    if (!slug) return { ok: false, error: "Slug inválido." };

    const supabase = admin();
    const { data: maxRow } = await supabase
      .schema("membros")
      .from("community_pages")
      .select("position")
      .eq("space_id", spaceId as string)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const next = ((maxRow?.position as number | undefined) ?? 0) + 1;

    const { error } = await supabase
      .schema("membros")
      .from("community_pages")
      .insert({
        space_id: spaceId,
        title,
        icon,
        slug,
        position: next,
        is_active: true,
      });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function updatePageAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const spaceId = String(formData.get("space_id") ?? "").trim() || null;
    const title = String(formData.get("title") ?? "").trim();
    const icon = String(formData.get("icon") ?? "").trim() || "💬";
    const slug = slugify(String(formData.get("slug") ?? "").trim() || title);
    const description =
      String(formData.get("description") ?? "").trim() || null;
    const isActive = formData.get("is_active") !== "off";

    if (!title) return { ok: false, error: "Nome é obrigatório." };
    if (!slug) return { ok: false, error: "Slug inválido." };

    const { error } = await admin()
      .schema("membros")
      .from("community_pages")
      .update({
        space_id: spaceId,
        title,
        icon,
        slug,
        description,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function deletePageAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const { error } = await admin()
      .schema("membros")
      .from("community_pages")
      .delete()
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

// ============================================================
// CRUD SIDEBAR LINKS
// ============================================================
export async function createSidebarLinkAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const label = String(formData.get("label") ?? "").trim();
    const url = String(formData.get("url") ?? "").trim();
    const icon = String(formData.get("icon") ?? "").trim() || "🔗";
    const openInNewTab = formData.get("open_in_new_tab") !== "off";

    if (!label) return { ok: false, error: "Label é obrigatório." };
    if (!url) return { ok: false, error: "URL é obrigatória." };

    const supabase = admin();
    const { data: maxRow } = await supabase
      .schema("membros")
      .from("community_sidebar_links")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const next = ((maxRow?.position as number | undefined) ?? 0) + 1;

    const { error } = await supabase
      .schema("membros")
      .from("community_sidebar_links")
      .insert({
        label,
        url,
        icon,
        position: next,
        open_in_new_tab: openInNewTab,
        is_active: true,
      });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function deleteSidebarLinkAction(
  id: string,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const { error } = await admin()
      .schema("membros")
      .from("community_sidebar_links")
      .delete()
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
