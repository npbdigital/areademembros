/**
 * Helpers pra ler/escrever configurações de plataforma (whitelabel).
 *
 * As configs vivem em `membros.platform_settings` no formato chave/valor (text).
 * Use as constantes `SETTINGS_KEYS` pra evitar erros de digitação.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const SETTINGS_KEYS = {
  PLATFORM_NAME: "platform_name",
  PLATFORM_LOGO_URL: "platform_logo_url",
  PLATFORM_FAVICON_URL: "platform_favicon_url",
  EMAIL_FROM_ADDRESS: "email_from_address",
  EMAIL_FROM_NAME: "email_from_name",
  PRIMARY_COLOR: "primary_color",
  SUPPORT_EMAIL: "support_email",
  SUPPORT_WHATSAPP: "support_whatsapp",
  WELCOME_ENABLED: "welcome_enabled",
  WELCOME_TITLE: "welcome_title",
  WELCOME_DESCRIPTION: "welcome_description",
  WELCOME_VIDEO_ID: "welcome_video_id",
  WELCOME_TERMS: "welcome_terms",
  WELCOME_BUTTON_LABEL: "welcome_button_label",
  // Comunidade
  COMMUNITY_AUTO_APPROVE: "community_auto_approve",
  COMMUNITY_MAX_IMAGE_MB: "community_max_image_mb",
  COMMUNITY_MAX_COMMENT_CHARS: "community_max_comment_chars",
  // Gamification
  GAMIFICATION_ENABLED: "gamification_enabled",
  XP_LESSON_COMPLETE: "xp_lesson_complete",
  XP_STREAK_7D: "xp_streak_7d",
  XP_FIRST_ACCESS_DAY: "xp_first_access_day",
  XP_LESSON_RATED: "xp_lesson_rated",
  XP_COMMENT_APPROVED: "xp_comment_approved",
  XP_POST_APPROVED: "xp_post_approved",
  XP_COURSE_COMPLETED: "xp_course_completed",
  LEADERBOARD_VISIBLE_TO_ADMIN: "leaderboard_visible_to_admin",
  LEADERBOARD_VISIBLE_TO_MODERATOR: "leaderboard_visible_to_moderator",
  LEADERBOARD_VISIBLE_TO_STUDENT: "leaderboard_visible_to_student",
  // Push notifications
  PUSH_NOTIFICATIONS_ENABLED: "push_notifications_enabled",
} as const;

export type SettingKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

export interface PlatformSettings {
  platformName: string;
  platformLogoUrl: string | null;
  platformFaviconUrl: string | null;
  emailFromAddress: string | null;
  emailFromName: string | null;
  primaryColor: string | null;
  supportEmail: string | null;
  supportWhatsapp: string | null;
  welcomeEnabled: boolean;
  welcomeTitle: string;
  welcomeDescription: string;
  welcomeVideoId: string | null;
  welcomeTerms: string;
  welcomeButtonLabel: string;
  // Comunidade
  communityAutoApprove: boolean;
  communityMaxImageMb: number;
  communityMaxCommentChars: number;
  // Gamification
  gamificationEnabled: boolean;
  xpLessonComplete: number;
  xpStreak7d: number;
  xpFirstAccessDay: number;
  xpLessonRated: number;
  xpCommentApproved: number;
  xpPostApproved: number;
  xpCourseCompleted: number;
  leaderboardVisibleToAdmin: boolean;
  leaderboardVisibleToModerator: boolean;
  leaderboardVisibleToStudent: boolean;
  pushNotificationsEnabled: boolean;
}

/** Defaults aplicados quando a chave não está no banco. */
export const SETTINGS_DEFAULTS: PlatformSettings = {
  platformName: "Academia NPB",
  platformLogoUrl: null,
  platformFaviconUrl: null,
  emailFromAddress: null,
  emailFromName: null,
  primaryColor: null,
  supportEmail: null,
  supportWhatsapp: null,
  welcomeEnabled: false,
  welcomeTitle: "Bem-vindo!",
  welcomeDescription: "Antes de começar, leia e aceite os termos abaixo.",
  welcomeVideoId: null,
  welcomeTerms: "",
  welcomeButtonLabel: "Eu concordo com os termos",
  communityAutoApprove: false,
  communityMaxImageMb: 10,
  communityMaxCommentChars: 10000,
  gamificationEnabled: true,
  xpLessonComplete: 10,
  xpStreak7d: 50,
  xpFirstAccessDay: 2,
  xpLessonRated: 3,
  xpCommentApproved: 5,
  xpPostApproved: 20,
  xpCourseCompleted: 100,
  leaderboardVisibleToAdmin: true,
  leaderboardVisibleToModerator: true,
  leaderboardVisibleToStudent: false,
  pushNotificationsEnabled: true,
};

/** Lê todas as configs num único hit. */
export async function getPlatformSettings(
  supabase: SupabaseClient,
): Promise<PlatformSettings> {
  const { data } = await supabase
    .schema("membros")
    .from("platform_settings")
    .select("key, value");

  const map = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ key: string; value: string }>) {
    if (row.value !== null && row.value !== undefined) {
      map.set(row.key, row.value);
    }
  }

  return {
    platformName:
      map.get(SETTINGS_KEYS.PLATFORM_NAME)?.trim() ||
      SETTINGS_DEFAULTS.platformName,
    platformLogoUrl: map.get(SETTINGS_KEYS.PLATFORM_LOGO_URL)?.trim() || null,
    platformFaviconUrl:
      map.get(SETTINGS_KEYS.PLATFORM_FAVICON_URL)?.trim() || null,
    emailFromAddress:
      map.get(SETTINGS_KEYS.EMAIL_FROM_ADDRESS)?.trim() || null,
    emailFromName: map.get(SETTINGS_KEYS.EMAIL_FROM_NAME)?.trim() || null,
    primaryColor: map.get(SETTINGS_KEYS.PRIMARY_COLOR)?.trim() || null,
    supportEmail: map.get(SETTINGS_KEYS.SUPPORT_EMAIL)?.trim() || null,
    supportWhatsapp: map.get(SETTINGS_KEYS.SUPPORT_WHATSAPP)?.trim() || null,
    welcomeEnabled:
      (map.get(SETTINGS_KEYS.WELCOME_ENABLED) ?? "").toLowerCase() === "true",
    welcomeTitle:
      map.get(SETTINGS_KEYS.WELCOME_TITLE)?.trim() ||
      SETTINGS_DEFAULTS.welcomeTitle,
    welcomeDescription:
      map.get(SETTINGS_KEYS.WELCOME_DESCRIPTION)?.trim() ||
      SETTINGS_DEFAULTS.welcomeDescription,
    welcomeVideoId: map.get(SETTINGS_KEYS.WELCOME_VIDEO_ID)?.trim() || null,
    welcomeTerms: map.get(SETTINGS_KEYS.WELCOME_TERMS) ?? "",
    welcomeButtonLabel:
      map.get(SETTINGS_KEYS.WELCOME_BUTTON_LABEL)?.trim() ||
      SETTINGS_DEFAULTS.welcomeButtonLabel,
    communityAutoApprove: parseBool(
      map.get(SETTINGS_KEYS.COMMUNITY_AUTO_APPROVE),
      SETTINGS_DEFAULTS.communityAutoApprove,
    ),
    communityMaxImageMb: parseInt2(
      map.get(SETTINGS_KEYS.COMMUNITY_MAX_IMAGE_MB),
      SETTINGS_DEFAULTS.communityMaxImageMb,
    ),
    communityMaxCommentChars: parseInt2(
      map.get(SETTINGS_KEYS.COMMUNITY_MAX_COMMENT_CHARS),
      SETTINGS_DEFAULTS.communityMaxCommentChars,
    ),
    gamificationEnabled: parseBool(
      map.get(SETTINGS_KEYS.GAMIFICATION_ENABLED),
      SETTINGS_DEFAULTS.gamificationEnabled,
    ),
    xpLessonComplete: parseInt2(
      map.get(SETTINGS_KEYS.XP_LESSON_COMPLETE),
      SETTINGS_DEFAULTS.xpLessonComplete,
    ),
    xpStreak7d: parseInt2(
      map.get(SETTINGS_KEYS.XP_STREAK_7D),
      SETTINGS_DEFAULTS.xpStreak7d,
    ),
    xpFirstAccessDay: parseInt2(
      map.get(SETTINGS_KEYS.XP_FIRST_ACCESS_DAY),
      SETTINGS_DEFAULTS.xpFirstAccessDay,
    ),
    xpLessonRated: parseInt2(
      map.get(SETTINGS_KEYS.XP_LESSON_RATED),
      SETTINGS_DEFAULTS.xpLessonRated,
    ),
    xpCommentApproved: parseInt2(
      map.get(SETTINGS_KEYS.XP_COMMENT_APPROVED),
      SETTINGS_DEFAULTS.xpCommentApproved,
    ),
    xpPostApproved: parseInt2(
      map.get(SETTINGS_KEYS.XP_POST_APPROVED),
      SETTINGS_DEFAULTS.xpPostApproved,
    ),
    xpCourseCompleted: parseInt2(
      map.get(SETTINGS_KEYS.XP_COURSE_COMPLETED),
      SETTINGS_DEFAULTS.xpCourseCompleted,
    ),
    leaderboardVisibleToAdmin: parseBool(
      map.get(SETTINGS_KEYS.LEADERBOARD_VISIBLE_TO_ADMIN),
      SETTINGS_DEFAULTS.leaderboardVisibleToAdmin,
    ),
    leaderboardVisibleToModerator: parseBool(
      map.get(SETTINGS_KEYS.LEADERBOARD_VISIBLE_TO_MODERATOR),
      SETTINGS_DEFAULTS.leaderboardVisibleToModerator,
    ),
    leaderboardVisibleToStudent: parseBool(
      map.get(SETTINGS_KEYS.LEADERBOARD_VISIBLE_TO_STUDENT),
      SETTINGS_DEFAULTS.leaderboardVisibleToStudent,
    ),
    pushNotificationsEnabled: parseBool(
      map.get(SETTINGS_KEYS.PUSH_NOTIFICATIONS_ENABLED),
      SETTINGS_DEFAULTS.pushNotificationsEnabled,
    ),
  };
}

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback;
  return v.trim().toLowerCase() === "true";
}

function parseInt2(v: string | undefined, fallback: number): number {
  if (v === undefined) return fallback;
  const n = parseInt(v.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function canSeeLeaderboard(
  settings: PlatformSettings,
  role: string | null | undefined,
): boolean {
  if (role === "admin") return settings.leaderboardVisibleToAdmin;
  if (role === "moderator") return settings.leaderboardVisibleToModerator;
  return settings.leaderboardVisibleToStudent;
}

/** Monta o "From: Nome <email>" pro Resend respeitando settings/env/default. */
export function buildResendFrom(
  settings: PlatformSettings | null,
  envFallback: { address?: string; name?: string } = {},
): string {
  const address =
    settings?.emailFromAddress ||
    envFallback.address ||
    process.env.RESEND_FROM_EMAIL ||
    "onboarding@resend.dev";
  const name =
    settings?.emailFromName ||
    envFallback.name ||
    process.env.RESEND_FROM_NAME ||
    settings?.platformName ||
    "Academia NPB";
  return `${name} <${address}>`;
}
