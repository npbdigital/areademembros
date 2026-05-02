"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/community";

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
    const { error } = await admin()
      .schema("membros")
      .from("community_topics")
      .update({
        status: "approved",
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", topicId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/community");
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
    const { error } = await admin()
      .schema("membros")
      .from("community_topics")
      .update({
        status: "rejected",
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", topicId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/community");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

// ============================================================
// CRUD GALERIAS (espaços)
// ============================================================
export async function createGalleryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    const icon = String(formData.get("icon") ?? "").trim() || "💬";
    const slug = slugify(String(formData.get("slug") ?? "").trim() || title);

    if (!title) return { ok: false, error: "Nome é obrigatório." };
    if (!slug) return { ok: false, error: "Slug inválido." };

    const supabase = admin();
    // próximo position
    const { data: maxRow } = await supabase
      .schema("membros")
      .from("community_galleries")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const next = ((maxRow?.position as number | undefined) ?? 0) + 1;

    const { error } = await supabase
      .schema("membros")
      .from("community_galleries")
      .insert({
        title,
        description,
        icon,
        slug,
        position: next,
        is_active: true,
      });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/community/spaces");
    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function updateGalleryAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    const icon = String(formData.get("icon") ?? "").trim() || "💬";
    const slug = slugify(String(formData.get("slug") ?? "").trim() || title);
    const isActive = formData.get("is_active") === "on";

    if (!title) return { ok: false, error: "Nome é obrigatório." };
    if (!slug) return { ok: false, error: "Slug inválido." };

    const { error } = await admin()
      .schema("membros")
      .from("community_galleries")
      .update({
        title,
        description,
        icon,
        slug,
        is_active: isActive,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/community/spaces");
    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function deleteGalleryAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const { error } = await admin()
      .schema("membros")
      .from("community_galleries")
      .delete()
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/community/spaces");
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
    revalidatePath("/admin/community/links");
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
    revalidatePath("/admin/community/links");
    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
