/**
 * One-click login helpers — gera tokens mágicos pra login sem senha.
 *
 * Fluxo:
 *   1. Webhook (ou admin via /admin/one-click-test) cria token via
 *      `generateMagicToken(userId, source)`.
 *   2. Aluno recebe link `https://.../api/auth/one-click?token=UUID`.
 *   3. /api/auth/one-click valida o token e cria sessão Supabase.
 *
 * Token tem 7 dias de validade, é REUTILIZÁVEL nesse período (aluno pode
 * voltar várias vezes pelo mesmo link). Atualiza `last_used_at` em cada uso.
 *
 * Tabela: membros.magic_login_tokens (RLS bloqueia tudo exceto service_role).
 */

import { createAdminClient } from "@/lib/supabase/server";

const TOKEN_TTL_DAYS = 7;

export interface MagicTokenRecord {
  token: string;
  user_id: string;
  expires_at: string;
  last_used_at: string | null;
  created_at: string;
  source: string;
}

/**
 * Cria um token mágico vinculado ao user. Reaproveita um existente se
 * ainda estiver válido (evita encher a tabela quando webhook reprocessa).
 */
export async function generateMagicToken(
  userId: string,
  source: string = "webhook",
): Promise<{ token: string; expiresAt: string } | null> {
  try {
    const admin = createAdminClient();

    // Procura token válido existente
    const nowIso = new Date().toISOString();
    const { data: existing } = await admin
      .schema("membros")
      .from("magic_login_tokens")
      .select("token, expires_at")
      .eq("user_id", userId)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return {
        token: (existing as { token: string }).token,
        expiresAt: (existing as { expires_at: string }).expires_at,
      };
    }

    const expiresAt = new Date(
      Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data, error } = await admin
      .schema("membros")
      .from("magic_login_tokens")
      .insert({
        user_id: userId,
        expires_at: expiresAt,
        source,
      })
      .select("token, expires_at")
      .single();

    if (error || !data) return null;
    return {
      token: (data as { token: string }).token,
      expiresAt: (data as { expires_at: string }).expires_at,
    };
  } catch {
    return null;
  }
}

/**
 * Valida e consome (atualiza last_used_at) um token. Devolve o user_id
 * se válido, null caso contrário.
 */
export async function validateMagicToken(
  token: string,
): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .schema("membros")
      .from("magic_login_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    const row = data as { user_id: string; expires_at: string } | null;
    if (!row) return null;

    if (new Date(row.expires_at) < new Date()) {
      // Expirado — limpa pra higiene (best-effort)
      await admin
        .schema("membros")
        .from("magic_login_tokens")
        .delete()
        .eq("token", token);
      return null;
    }

    // Atualiza last_used_at (não bloqueia — fire & forget)
    await admin
      .schema("membros")
      .from("magic_login_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("token", token);

    return row.user_id;
  } catch {
    return null;
  }
}

/**
 * Marca user pra fluxo de onboarding (criar senha + foto após one-click).
 * Idempotente: chamar várias vezes não tem efeito.
 */
export async function markUserNeedsOnboarding(
  userId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .schema("membros")
      .from("users")
      .update({ needs_onboarding: true })
      .eq("id", userId)
      .eq("needs_onboarding", false); // só marca se ainda não passou
  } catch {
    // best-effort
  }
}

/**
 * Monta URL absoluta do link one-click.
 * Use NEXT_PUBLIC_APP_URL pra produção, fallback localhost.
 */
export function buildOneClickUrl(token: string): string {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${origin}/api/auth/one-click?token=${token}`;
}
