"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type ActionResult<T = unknown> = {
  ok: boolean;
  error?: string;
  data?: T;
};

async function assertAdmin(): Promise<void> {
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
  if ((profile as { role?: string } | null)?.role !== "admin") {
    throw new Error("Sem permissão.");
  }
}

const BUCKET = "avatar-decorations";

/** Upload PNG/WebP/GIF e seta como image_url da decoração. */
export async function uploadDecorationImageAction(
  decorationId: string,
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  try {
    await assertAdmin();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "Arquivo inválido." };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { ok: false, error: "Imagem maior que 5MB." };
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    if (!["png", "webp", "gif"].includes(ext)) {
      return { ok: false, error: "Use PNG, WebP ou GIF." };
    }

    const sb = createAdminClient();

    // Pega o code da decoração pra usar no path do storage
    const { data: dec } = await sb
      .schema("membros")
      .from("avatar_decorations")
      .select("code")
      .eq("id", decorationId)
      .maybeSingle();
    const code = (dec as { code?: string } | null)?.code;
    if (!code) return { ok: false, error: "Decoração não encontrada." };

    // Path estável por decoração (com timestamp pra busted cache)
    const path = `${code}-${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });
    if (upErr) return { ok: false, error: upErr.message };

    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    const url = pub.publicUrl;

    // Atualiza a row
    const { error: updErr } = await sb
      .schema("membros")
      .from("avatar_decorations")
      .update({ image_url: url, updated_at: new Date().toISOString() })
      .eq("id", decorationId);
    if (updErr) return { ok: false, error: updErr.message };

    revalidatePath("/admin/decorations");
    revalidatePath("/profile");
    return { ok: true, data: { url } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Renomeia a decoração (admin pode trocar o label exibido pro aluno). */
export async function updateDecorationNameAction(
  decorationId: string,
  newName: string,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const trimmed = newName.trim();
    if (!trimmed) return { ok: false, error: "Nome obrigatório." };
    if (trimmed.length > 60) return { ok: false, error: "Nome muito longo." };

    const sb = createAdminClient();
    const { error } = await sb
      .schema("membros")
      .from("avatar_decorations")
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq("id", decorationId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/decorations");
    revalidatePath("/profile");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Toggle ativo (decoração some das opções dos alunos sem deletar). */
export async function toggleDecorationActiveAction(
  decorationId: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = createAdminClient();
    const { error } = await sb
      .schema("membros")
      .from("avatar_decorations")
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq("id", decorationId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/decorations");
    revalidatePath("/profile");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
