/**
 * Sistema de decorações de avatar (estilo Discord).
 *
 * Modelo:
 * - `membros.avatar_decorations` é o catálogo (admin gerencia).
 * - `membros.users.equipped_decoration_id` é o que o aluno tem equipado (1 só).
 * - Desbloqueio: vendas Kiwify pagas atribuídas (member_user_id = aluno).
 *   Marcos definidos por `required_sales` em cada decoração — admin sabe,
 *   aluno só vê "bloqueado" sem o número.
 * - Auto-equipa ao desbloquear novo marco. Aluno pode trocar/remover.
 *
 * Notas:
 * - Conta vendas via afiliados.sales onde status='paid' E member_user_id=user.
 * - Reversal (refund/chargeback) reduz a contagem; mas como auto-equipar
 *   só dispara em INSERT/upgrade, decoração já equipada NÃO é removida
 *   automaticamente em reversão. Decisão pra evitar mexer na vitrine do
 *   aluno depois que ele já viu/aproveitou.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { tryNotify } from "@/lib/notifications";

export interface DecorationRow {
  id: string;
  code: string;
  name: string;
  image_url: string | null;
  required_sales: number;
  sort_order: number;
  is_active: boolean;
}

/**
 * Lê o catálogo ativo (asc por required_sales — menor primeiro).
 */
export async function listActiveDecorations(
  supabase: SupabaseClient,
): Promise<DecorationRow[]> {
  const { data } = await supabase
    .schema("membros")
    .from("avatar_decorations")
    .select(
      "id, code, name, image_url, required_sales, sort_order, is_active",
    )
    .eq("is_active", true)
    .order("required_sales", { ascending: true });
  return (data ?? []) as DecorationRow[];
}

/**
 * Conta vendas Kiwify pagas atribuídas a esse user.
 */
export async function countPaidSales(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .schema("afiliados")
    .from("sales")
    .select("id", { count: "exact", head: true })
    .eq("member_user_id", userId)
    .eq("status", "paid");
  return count ?? 0;
}

/**
 * Avaliação após uma venda paga ser atribuída/criada. Detecta novo marco
 * desbloqueado, equipa automaticamente (substituindo um menor) e notifica.
 *
 * Idempotente: se aluno já está com o marco mais alto possível, no-op.
 *
 * @param newSalesCount contagem ATUAL (incluindo a venda recém-creditada)
 */
export async function evaluateAvatarDecorations(
  supabase: SupabaseClient,
  userId: string,
  newSalesCount?: number,
): Promise<void> {
  const decorations = await listActiveDecorations(supabase);
  if (decorations.length === 0) return;

  const salesCount = newSalesCount ?? (await countPaidSales(supabase, userId));
  if (salesCount <= 0) return;

  // Maior decoração que o aluno se qualifica
  const eligible = decorations
    .filter((d) => salesCount >= d.required_sales)
    .reduce<DecorationRow | null>(
      (max, d) =>
        max === null || d.required_sales > max.required_sales ? d : max,
      null,
    );
  if (!eligible) return;

  // Estado atual do user
  const { data: userRow } = await supabase
    .schema("membros")
    .from("users")
    .select("equipped_decoration_id")
    .eq("id", userId)
    .maybeSingle();
  const equippedId = (userRow as { equipped_decoration_id: string | null } | null)
    ?.equipped_decoration_id ?? null;

  if (equippedId === eligible.id) return; // já equipado

  // Se equipou outra (manualmente trocou), só substitui se a nova for mais
  // alta. Evita "roubar" escolha do aluno que voluntariamente equipou uma
  // menor que ele gosta mais.
  if (equippedId) {
    const current = decorations.find((d) => d.id === equippedId);
    if (current && current.required_sales >= eligible.required_sales) return;
  }

  await supabase
    .schema("membros")
    .from("users")
    .update({ equipped_decoration_id: eligible.id })
    .eq("id", userId);

  await tryNotify({
    userId,
    title: `Nova decoração desbloqueada: ${eligible.name}`,
    body: "Equipada automaticamente. Você pode trocar ou remover no seu perfil.",
    link: "/profile#decorations",
    pushCategory: "achievement_unlocked",
  });
}
