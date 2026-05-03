"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; error?: string };

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

export async function setAchievementFlagsAction(params: {
  achievementId: string;
  celebrate?: boolean;
  shareable?: boolean;
}): Promise<ActionResult> {
  try {
    await assertAdmin();
    const updates: Record<string, unknown> = {};
    if (typeof params.celebrate === "boolean") {
      updates.celebrate = params.celebrate;
    }
    if (typeof params.shareable === "boolean") {
      updates.shareable = params.shareable;
    }
    if (Object.keys(updates).length === 0) {
      return { ok: false, error: "Nada pra atualizar." };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .schema("membros")
      .from("achievements")
      .update(updates)
      .eq("id", params.achievementId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/achievements");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/**
 * Faz upload de imagem custom pra conquista. Substitui imagem anterior se
 * houver. Path: {achievementId}/{uuid}.{ext}.
 */
export async function uploadAchievementImageAction(
  achievementId: string,
  formData: FormData,
): Promise<ActionResult & { url?: string }> {
  try {
    await assertAdmin();

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "Arquivo inválido." };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { ok: false, error: "Imagem maior que 5MB." };
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      return { ok: false, error: "Formato não suportado (use JPG/PNG/WebP)." };
    }

    const admin = createAdminClient();
    const path = `${achievementId}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await admin.storage
      .from("achievement-images")
      .upload(path, file, { contentType: file.type, cacheControl: "3600" });
    if (upErr) return { ok: false, error: upErr.message };

    const { data } = admin.storage
      .from("achievement-images")
      .getPublicUrl(path);
    const url = data.publicUrl;

    const { error: updErr } = await admin
      .schema("membros")
      .from("achievements")
      .update({ celebration_image_url: url })
      .eq("id", achievementId);
    if (updErr) return { ok: false, error: updErr.message };

    revalidatePath("/admin/achievements");
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function clearAchievementImageAction(
  achievementId: string,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const admin = createAdminClient();
    const { error } = await admin
      .schema("membros")
      .from("achievements")
      .update({ celebration_image_url: null })
      .eq("id", achievementId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/achievements");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/**
 * Linka conquista a uma decoração de avatar — quando o aluno desbloqueia,
 * o popup celebrativo mostra avatar + frame + "você desbloqueou esse frame"
 * em vez da imagem genérica.
 *
 * Passar decorationId=null pra desfazer o link.
 */
export async function setAchievementDecorationAction(params: {
  achievementId: string;
  decorationId: string | null;
}): Promise<ActionResult> {
  try {
    await assertAdmin();
    const admin = createAdminClient();
    const { error } = await admin
      .schema("membros")
      .from("achievements")
      .update({ unlocks_decoration_id: params.decorationId })
      .eq("id", params.achievementId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/achievements");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
