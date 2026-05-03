/**
 * Helper genérico pra hidratar metadados de autor pra render em listagens
 * de comunidade: decoração de avatar equipada (URL) + nível atual.
 *
 * Usado em /community/feed, /community/[slug], /community/[slug]/post/[postId]
 * (autor + comentários). Centraliza pra evitar 3+ queries duplicadas em
 * cada page que mostra autor.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuthorMeta {
  decorationUrl: string | null;
  level: number | null; // null = sem user_xp (ex: admin, ou novo)
}

/**
 * Dado uma lista de userIds, devolve um Map<userId, AuthorMeta> com
 * decoration_url e current_level resolvidos. Faz 3 queries paralelas.
 *
 * Use admin client (service_role) — RLS de user_xp/users impediria leitura
 * cruzada.
 */
export async function fetchAuthorMeta(
  adminSb: SupabaseClient,
  userIds: string[],
): Promise<Map<string, AuthorMeta>> {
  const out = new Map<string, AuthorMeta>();
  if (userIds.length === 0) return out;

  const [usersRes, xpRes] = await Promise.all([
    adminSb
      .schema("membros")
      .from("users")
      .select("id, equipped_decoration_id, role")
      .in("id", userIds),
    adminSb
      .schema("membros")
      .from("user_xp")
      .select("user_id, current_level")
      .in("user_id", userIds),
  ]);

  const userRows = (usersRes.data ?? []) as Array<{
    id: string;
    equipped_decoration_id: string | null;
    role: string;
  }>;
  const xpRows = (xpRes.data ?? []) as Array<{
    user_id: string;
    current_level: number;
  }>;

  // Resolve decoração: query secundária pelos ids únicos
  const decoIds = Array.from(
    new Set(
      userRows
        .map((u) => u.equipped_decoration_id)
        .filter((x): x is string => !!x),
    ),
  );
  const decoMap = new Map<string, string | null>();
  if (decoIds.length > 0) {
    const { data: decos } = await adminSb
      .schema("membros")
      .from("avatar_decorations")
      .select("id, image_url, is_active")
      .in("id", decoIds);
    for (const d of (decos ?? []) as Array<{
      id: string;
      image_url: string | null;
      is_active: boolean;
    }>) {
      if (d.is_active && d.image_url) decoMap.set(d.id, d.image_url);
    }
  }

  const xpByUser = new Map<string, number>(
    xpRows.map((x) => [x.user_id, x.current_level]),
  );

  for (const u of userRows) {
    out.set(u.id, {
      decorationUrl: u.equipped_decoration_id
        ? decoMap.get(u.equipped_decoration_id) ?? null
        : null,
      // Admin não tem gamification — força level null pra não exibir badge
      level: u.role === "admin" ? null : xpByUser.get(u.id) ?? null,
    });
  }

  return out;
}

/** Versão pra um único user (pra header de post detail, etc). */
export async function fetchSingleAuthorMeta(
  adminSb: SupabaseClient,
  userId: string,
): Promise<AuthorMeta> {
  const map = await fetchAuthorMeta(adminSb, [userId]);
  return map.get(userId) ?? { decorationUrl: null, level: null };
}
