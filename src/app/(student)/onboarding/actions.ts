"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; error?: string };

/**
 * Salva senha + nome + avatar opcional e marca needs_onboarding=false.
 * Usado pela tela /onboarding após one-click login.
 */
export async function completeOnboardingAction(params: {
  fullName: string;
  password?: string;
  avatarUrl?: string | null;
}): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado." };

    const fullName = params.fullName.trim();
    if (!fullName) return { ok: false, error: "Nome é obrigatório." };

    // Senha opcional (aluno pode pular). Quando fornecida, valida >= 6
    const newPassword = params.password?.trim() ?? "";
    if (newPassword && newPassword.length < 6) {
      return { ok: false, error: "Senha precisa ter pelo menos 6 caracteres." };
    }

    const admin = createAdminClient();

    // 1. Atualiza nome + avatar + flag needs_onboarding
    const updates: Record<string, unknown> = {
      full_name: fullName,
      needs_onboarding: false,
    };
    if (typeof params.avatarUrl !== "undefined") {
      updates.avatar_url = params.avatarUrl;
    }
    const { error: profileErr } = await admin
      .schema("membros")
      .from("users")
      .update(updates)
      .eq("id", user.id);
    if (profileErr) return { ok: false, error: profileErr.message };

    // 2. Atualiza senha (se fornecida) via auth admin
    if (newPassword) {
      const { error: pwErr } = await admin.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });
      if (pwErr) return { ok: false, error: pwErr.message };

      // Trocar senha invalida todas as sessões existentes (incluindo a do
      // próprio aluno que veio do magic link). Re-sign-in imediato com a
      // nova senha pra reescrever os cookies de sessão — sem isso, o
      // próximo request cai no /login.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: newPassword,
      });
      if (signInErr) return { ok: false, error: signInErr.message };
    }

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/**
 * Upload de avatar pro bucket avatars (já existente do /profile).
 * Path: {userId}/{uuid}.{ext}.
 */
export async function uploadOnboardingAvatarAction(
  formData: FormData,
): Promise<ActionResult & { url?: string }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado." };

    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "Arquivo inválido." };
    if (file.size > 5 * 1024 * 1024) {
      return { ok: false, error: "Imagem maior que 5MB." };
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      return { ok: false, error: "Formato não suportado." };
    }

    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const admin = createAdminClient();
    const { error } = await admin.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type, cacheControl: "3600" });
    if (error) return { ok: false, error: error.message };

    const { data } = admin.storage.from("avatars").getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
