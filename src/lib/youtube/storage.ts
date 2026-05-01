import { createAdminClient } from "@/lib/supabase/server";
import { decrypt, encrypt } from "@/lib/crypto";

export const YT_KEY_TOKENS = "youtube_oauth_tokens";
export const YT_KEY_META = "youtube_oauth_meta";

export interface YouTubeTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch millis
  scope: string;
}

export interface YouTubeMeta {
  channel_id: string;
  channel_title: string;
  channel_thumbnail: string | null;
  connected_at: string; // ISO
}

function admin() {
  return createAdminClient().schema("membros");
}

async function upsertSetting(key: string, value: string) {
  const { error } = await admin()
    .from("platform_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`Falha salvando ${key}: ${error.message}`);
}

async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await admin()
    .from("platform_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(`Falha lendo ${key}: ${error.message}`);
  return data?.value ?? null;
}

async function deleteSetting(key: string) {
  const { error } = await admin().from("platform_settings").delete().eq("key", key);
  if (error) throw new Error(`Falha apagando ${key}: ${error.message}`);
}

export async function saveYouTubeTokens(tokens: YouTubeTokens) {
  await upsertSetting(YT_KEY_TOKENS, encrypt(JSON.stringify(tokens)));
}

export async function loadYouTubeTokens(): Promise<YouTubeTokens | null> {
  const raw = await getSetting(YT_KEY_TOKENS);
  if (!raw) return null;
  try {
    return JSON.parse(decrypt(raw)) as YouTubeTokens;
  } catch {
    return null;
  }
}

export async function saveYouTubeMeta(meta: YouTubeMeta) {
  await upsertSetting(YT_KEY_META, JSON.stringify(meta));
}

export async function loadYouTubeMeta(): Promise<YouTubeMeta | null> {
  const raw = await getSetting(YT_KEY_META);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as YouTubeMeta;
  } catch {
    return null;
  }
}

export async function clearYouTubeConnection() {
  await Promise.all([deleteSetting(YT_KEY_TOKENS), deleteSetting(YT_KEY_META)]);
}
