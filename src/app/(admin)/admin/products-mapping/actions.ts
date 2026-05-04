"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type ActionResult<T = unknown> = {
  ok: boolean;
  error?: string;
  data?: T;
};

async function assertAdmin(): Promise<string> {
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
  return user.id;
}

/**
 * Cria ou atualiza o mapeamento de um produto pra uma turma. Usa
 * `product_name` (lowercased) como chave única — agregação cross-platform
 * (Kiwify/Hubla/Payt/Youshop vendem o mesmo produto e vão pra mesma turma).
 *
 * Reaproveita a coluna `product_name_pattern` que já existe na tabela
 * (era pra suportar regex no futuro, mas hoje usamos como string literal).
 *
 * Quando salva, processa retroativamente as `purchase_events` que estavam
 * com status='unmapped' pra esse produto — elas vão automaticamente pra
 * 'pending' e o cron pega na próxima rodada.
 */
export async function saveProductMappingAction(params: {
  productName: string;
  cohortId: string;
  defaultExpiresDays: number | null;
}): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = createAdminClient();

    const productName = params.productName.trim().toLowerCase();
    if (!productName) return { ok: false, error: "Nome do produto vazio." };
    if (!params.cohortId) return { ok: false, error: "Selecione uma turma." };

    // Verifica se já existe (pra dar update em vez de duplicar)
    const { data: existing } = await sb
      .schema("membros")
      .from("product_cohort_map")
      .select("id")
      .ilike("product_name_pattern", productName)
      .maybeSingle();

    if (existing) {
      const { error } = await sb
        .schema("membros")
        .from("product_cohort_map")
        .update({
          cohort_id: params.cohortId,
          default_expires_days: params.defaultExpiresDays,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", (existing as { id: string }).id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await sb
        .schema("membros")
        .from("product_cohort_map")
        .insert({
          product_name_pattern: productName,
          cohort_id: params.cohortId,
          default_expires_days: params.defaultExpiresDays,
          is_active: true,
        });
      if (error) return { ok: false, error: error.message };
    }

    // Reprocessa eventos pendentes desse produto: status unmapped -> pending
    await sb
      .schema("membros")
      .from("purchase_events")
      .update({ status: "pending", error_message: null })
      .eq("status", "unmapped")
      .ilike("product_name", productName);

    revalidatePath("/admin/products-mapping");
    revalidatePath("/admin/access-logs");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Remove o mapeamento — vendas futuras desse produto cairão em 'unmapped'. */
export async function removeProductMappingAction(
  productName: string,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = createAdminClient();

    const { error } = await sb
      .schema("membros")
      .from("product_cohort_map")
      .delete()
      .ilike("product_name_pattern", productName.trim().toLowerCase());
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/products-mapping");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/**
 * Liga/desliga o processamento automático global. Quando OFF, o trigger
 * SQL ainda enfileira em purchase_events, mas o endpoint/cron não cadastra
 * ninguém. Permite ativar/desativar a qualquer momento sem perder dados.
 */
export async function setAutoEnrollmentEnabledAction(
  enabled: boolean,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = createAdminClient();

    const { error } = await sb
      .schema("membros")
      .from("platform_settings")
      .upsert(
        {
          key: "auto_enrollment_enabled",
          value: enabled ? "true" : "false",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/products-mapping");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
