"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { SETTINGS_KEYS, type SettingKey } from "@/lib/settings";

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
  if (profile?.role !== "admin") throw new Error("Sem permissão.");
}

function admin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente no .env.local");
  }
  return createAdminClient();
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function updatePlatformSettingsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await assertAdmin();

    const welcomeEnabled = formData.get("welcome_enabled") === "on";
    const communityAutoApprove = formData.get("community_auto_approve") === "on";
    const gamificationEnabled = formData.get("gamification_enabled") === "on";
    const lbAdmin = formData.get("leaderboard_visible_to_admin") === "on";
    const lbMod = formData.get("leaderboard_visible_to_moderator") === "on";
    const lbStudent = formData.get("leaderboard_visible_to_student") === "on";

    const updates: Array<{ key: SettingKey; value: string | null }> = [
      { key: SETTINGS_KEYS.PLATFORM_NAME, value: str(formData, "platform_name") || null },
      {
        key: SETTINGS_KEYS.PLATFORM_LOGO_URL,
        value: str(formData, "platform_logo_url") || null,
      },
      {
        key: SETTINGS_KEYS.EMAIL_FROM_ADDRESS,
        value: str(formData, "email_from_address") || null,
      },
      {
        key: SETTINGS_KEYS.EMAIL_FROM_NAME,
        value: str(formData, "email_from_name") || null,
      },
      {
        key: SETTINGS_KEYS.PRIMARY_COLOR,
        value: str(formData, "primary_color") || null,
      },
      {
        key: SETTINGS_KEYS.SUPPORT_EMAIL,
        value: str(formData, "support_email") || null,
      },
      {
        key: SETTINGS_KEYS.SUPPORT_WHATSAPP,
        value: str(formData, "support_whatsapp") || null,
      },
      {
        key: SETTINGS_KEYS.WELCOME_ENABLED,
        value: welcomeEnabled ? "true" : "false",
      },
      {
        key: SETTINGS_KEYS.WELCOME_TITLE,
        value: str(formData, "welcome_title") || null,
      },
      {
        key: SETTINGS_KEYS.WELCOME_DESCRIPTION,
        value: str(formData, "welcome_description") || null,
      },
      {
        key: SETTINGS_KEYS.WELCOME_VIDEO_ID,
        value: str(formData, "welcome_video_id") || null,
      },
      {
        key: SETTINGS_KEYS.WELCOME_TERMS,
        value: str(formData, "welcome_terms") || null,
      },
      {
        key: SETTINGS_KEYS.WELCOME_BUTTON_LABEL,
        value: str(formData, "welcome_button_label") || null,
      },
      // Comunidade
      {
        key: SETTINGS_KEYS.COMMUNITY_AUTO_APPROVE,
        value: communityAutoApprove ? "true" : "false",
      },
      {
        key: SETTINGS_KEYS.COMMUNITY_MAX_IMAGE_MB,
        value: str(formData, "community_max_image_mb") || null,
      },
      {
        key: SETTINGS_KEYS.COMMUNITY_MAX_COMMENT_CHARS,
        value: str(formData, "community_max_comment_chars") || null,
      },
      // Gamification
      {
        key: SETTINGS_KEYS.GAMIFICATION_ENABLED,
        value: gamificationEnabled ? "true" : "false",
      },
      { key: SETTINGS_KEYS.XP_LESSON_COMPLETE, value: str(formData, "xp_lesson_complete") || null },
      { key: SETTINGS_KEYS.XP_STREAK_7D, value: str(formData, "xp_streak_7d") || null },
      { key: SETTINGS_KEYS.XP_FIRST_ACCESS_DAY, value: str(formData, "xp_first_access_day") || null },
      { key: SETTINGS_KEYS.XP_LESSON_RATED, value: str(formData, "xp_lesson_rated") || null },
      { key: SETTINGS_KEYS.XP_COMMENT_APPROVED, value: str(formData, "xp_comment_approved") || null },
      { key: SETTINGS_KEYS.XP_POST_APPROVED, value: str(formData, "xp_post_approved") || null },
      { key: SETTINGS_KEYS.XP_COURSE_COMPLETED, value: str(formData, "xp_course_completed") || null },
      { key: SETTINGS_KEYS.LEADERBOARD_VISIBLE_TO_ADMIN, value: lbAdmin ? "true" : "false" },
      { key: SETTINGS_KEYS.LEADERBOARD_VISIBLE_TO_MODERATOR, value: lbMod ? "true" : "false" },
      { key: SETTINGS_KEYS.LEADERBOARD_VISIBLE_TO_STUDENT, value: lbStudent ? "true" : "false" },
    ];

    const supabase = admin();

    // Upsert por chave (se já existe, atualiza; senão insere)
    for (const u of updates) {
      const { data: existing } = await supabase
        .schema("membros")
        .from("platform_settings")
        .select("id")
        .eq("key", u.key)
        .maybeSingle();

      if (existing) {
        await supabase
          .schema("membros")
          .from("platform_settings")
          .update({ value: u.value, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase
          .schema("membros")
          .from("platform_settings")
          .insert({ key: u.key, value: u.value });
      }
    }

    revalidatePath("/admin/settings", "layout");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}
