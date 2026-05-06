"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { processPurchaseEvent } from "@/lib/auto-enroll";

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
 * Aprova manualmente um evento de compra que ficou em status='unmapped'
 * ou 'failed'. Admin escolhe a cohort destino e o sistema processa como
 * se fosse o fluxo normal.
 *
 * Útil pra:
 *  - Produto que ainda não foi cadastrado em product_cohort_map mas o
 *    admin quer liberar o aluno desta venda
 *  - Falhas anteriores que precisam reprocessar manualmente
 */
export async function approveManuallyAction(params: {
  eventId: string;
  cohortId: string;
  expiresDays: number | null;
}): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = createAdminClient();

    if (!params.eventId || !params.cohortId) {
      return { ok: false, error: "Faltam dados." };
    }

    // Resgata o evento
    const { data: row } = await sb
      .schema("membros")
      .from("purchase_events")
      .select("id, status, product_name, event")
      .eq("id", params.eventId)
      .maybeSingle();
    const ev = row as
      | { id: string; status: string; product_name: string | null; event: string }
      | null;
    if (!ev) return { ok: false, error: "Evento não encontrado." };

    if (ev.event !== "Compra Aprovada") {
      return {
        ok: false,
        error: "Aprovação manual só pra eventos de Compra Aprovada.",
      };
    }

    // Estratégia: cria/atualiza um mapeamento "ad-hoc" pro produto desse
    // evento usando a cohort escolhida, resetar o evento pra pending e
    // reprocessar. O mapping fica salvo (admin pode editar/remover depois
    // em /admin/products-mapping). Isso evita ter que duplicar a lógica
    // de criação de user/enrollment.
    const productName = (ev.product_name ?? "").trim().toLowerCase();
    if (!productName) {
      return { ok: false, error: "Evento sem product_name; não dá pra mapear." };
    }

    // Upsert do mapping
    const { data: existing } = await sb
      .schema("membros")
      .from("product_cohort_map")
      .select("id")
      .ilike("product_name_pattern", productName)
      .maybeSingle();
    if (existing) {
      await sb
        .schema("membros")
        .from("product_cohort_map")
        .update({
          cohort_id: params.cohortId,
          default_expires_days: params.expiresDays,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", (existing as { id: string }).id);
    } else {
      await sb.schema("membros").from("product_cohort_map").insert({
        product_name_pattern: productName,
        cohort_id: params.cohortId,
        default_expires_days: params.expiresDays,
        is_active: true,
      });
    }

    // Reseta o evento e reprocessa
    await sb
      .schema("membros")
      .from("purchase_events")
      .update({
        status: "pending",
        error_message: null,
        processed_at: null,
      })
      .eq("id", params.eventId);

    const result = await processPurchaseEvent(params.eventId);
    if (!result.ok) {
      return { ok: false, error: result.message ?? "Falha ao processar." };
    }

    // Outros eventos do mesmo produto que estavam unmapped também voltam pra fila
    await sb
      .schema("membros")
      .from("purchase_events")
      .update({ status: "pending", error_message: null })
      .eq("status", "unmapped")
      .ilike("product_name", productName);

    revalidatePath("/admin/access-logs");
    revalidatePath("/admin/products-mapping");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/**
 * Apaga um purchase_event do log. Útil pra remover testes (johndoe@…),
 * webhooks duplicados sem conserto, ou ruído.
 *
 * NÃO desfaz cadastro/enrollment — se o evento ja foi processado, o aluno
 * continua matriculado. Pra revogar acesso, use a tela de pessoas.
 */
export async function deleteEventAction(
  eventId: string,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = createAdminClient();

    const { error } = await sb
      .schema("membros")
      .from("purchase_events")
      .delete()
      .eq("id", eventId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/access-logs");
    revalidatePath("/admin/products-mapping");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/**
 * Reprocessa um evento que estava em failed (sem mexer no mapping).
 * Útil pra retentar após corrigir algum problema externo (cohort criada,
 * email arrumado, etc.).
 */
export async function retryEventAction(eventId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = createAdminClient();

    await sb
      .schema("membros")
      .from("purchase_events")
      .update({
        status: "pending",
        error_message: null,
        processed_at: null,
      })
      .eq("id", eventId)
      .in("status", ["failed", "unmapped"]);

    const result = await processPurchaseEvent(eventId);
    if (!result.ok && result.status !== "skipped") {
      return { ok: false, error: result.message ?? "Falha." };
    }

    revalidatePath("/admin/access-logs");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
