"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { extractBucketPath } from "@/lib/storage-paths";

export type ActionResult = { ok: boolean; error?: string };

async function requireUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");
  return user.id;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableStr(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v === "" ? null : v;
}

export async function updateProfileAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const fullName = str(formData, "full_name");
    if (!fullName) return { ok: false, error: "Nome é obrigatório." };

    const emailNotificationsEnabled =
      formData.get("email_notifications_enabled") === "on";

    const newAvatarUrl = nullableStr(formData, "avatar_url");

    const supabase = createClient();

    // Pega avatar atual antes do UPDATE pra saber se trocou — se sim,
    // deletamos o arquivo antigo do bucket pra nao acumular orfaos.
    const { data: prev } = await supabase
      .schema("membros")
      .from("users")
      .select("avatar_url")
      .eq("id", userId)
      .single();
    const oldAvatarUrl = (prev as { avatar_url: string | null } | null)
      ?.avatar_url ?? null;

    const { error } = await supabase
      .schema("membros")
      .from("users")
      .update({
        full_name: fullName,
        phone: nullableStr(formData, "phone"),
        avatar_url: newAvatarUrl,
        email_notifications_enabled: emailNotificationsEnabled,
      })
      .eq("id", userId);

    if (error) return { ok: false, error: error.message };

    // Cleanup do avatar anterior — so se mudou E era do nosso bucket
    // (avatares legados de outras plataformas ficam intocados).
    if (oldAvatarUrl && oldAvatarUrl !== newAvatarUrl) {
      const oldPath = extractBucketPath(oldAvatarUrl, "avatars");
      if (oldPath) {
        await createAdminClient()
          .storage.from("avatars")
          .remove([oldPath])
          .catch(() => {
            // best-effort: se falhar, vira orfao mas nao quebra o save
          });
      }
    }

    revalidatePath("/profile");
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

export async function changeOwnPasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<ActionResult> {
  try {
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return {
        ok: false,
        error: "A nova senha precisa ter pelo menos 8 caracteres.",
      };
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !user.email) {
      return { ok: false, error: "Sessão inválida." };
    }

    // Reautentica antes de trocar (defesa contra sequestro de sessão)
    const { error: signinErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signinErr) {
      return { ok: false, error: "Senha atual incorreta." };
    }

    const { error: updErr } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updErr) return { ok: false, error: updErr.message };

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}
