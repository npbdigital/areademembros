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
  EMAIL_FROM_ADDRESS: "email_from_address",
  EMAIL_FROM_NAME: "email_from_name",
  PRIMARY_COLOR: "primary_color",
  SUPPORT_EMAIL: "support_email",
  SUPPORT_WHATSAPP: "support_whatsapp",
} as const;

export type SettingKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

export interface PlatformSettings {
  platformName: string;
  platformLogoUrl: string | null;
  emailFromAddress: string | null;
  emailFromName: string | null;
  primaryColor: string | null;
  supportEmail: string | null;
  supportWhatsapp: string | null;
}

/** Defaults aplicados quando a chave não está no banco. */
export const SETTINGS_DEFAULTS: PlatformSettings = {
  platformName: "Academia NPB",
  platformLogoUrl: null,
  emailFromAddress: null,
  emailFromName: null,
  primaryColor: null,
  supportEmail: null,
  supportWhatsapp: null,
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
    emailFromAddress:
      map.get(SETTINGS_KEYS.EMAIL_FROM_ADDRESS)?.trim() || null,
    emailFromName: map.get(SETTINGS_KEYS.EMAIL_FROM_NAME)?.trim() || null,
    primaryColor: map.get(SETTINGS_KEYS.PRIMARY_COLOR)?.trim() || null,
    supportEmail: map.get(SETTINGS_KEYS.SUPPORT_EMAIL)?.trim() || null,
    supportWhatsapp: map.get(SETTINGS_KEYS.SUPPORT_WHATSAPP)?.trim() || null,
  };
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
