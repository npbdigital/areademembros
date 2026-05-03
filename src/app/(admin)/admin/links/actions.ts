"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getOrCreateShortLink } from "@/lib/short-links";

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

export async function createShortLinkAction(
  _prev: ActionResult<{ slug: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ slug: string }>> {
  try {
    const userId = await assertAdmin();
    const url = String(formData.get("url") ?? "").trim();

    if (!url) return { ok: false, error: "URL é obrigatória." };
    if (!/^https?:\/\//i.test(url)) {
      return { ok: false, error: "URL precisa começar com http:// ou https://" };
    }
    if (url.length > 4000) {
      return { ok: false, error: "URL muito longa (max 4000 chars)." };
    }

    const slug = await getOrCreateShortLink(url, userId);
    revalidatePath("/admin/links");
    return { ok: true, data: { slug } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function deleteShortLinkAction(slug: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    if (!slug) return { ok: false, error: "Slug inválido." };

    const admin = createAdminClient().schema("membros");
    const { error } = await admin.from("short_links").delete().eq("slug", slug);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/links");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
