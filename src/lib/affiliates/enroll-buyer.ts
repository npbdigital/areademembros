/**
 * Helper compartilhado: enfileira matrícula a partir de um payload Kiwify.
 *
 * Usado por:
 *  - /api/webhooks/kiwify-direct (1 webhook por produto, cohort vem na URL)
 *  - /api/webhooks/kiwify        (vendas de afiliado, allowlist por product_id)
 *
 * Insere em `membros.purchase_events` com `matched_cohort_id` já preenchido
 * (pulando o lookup do product_cohort_map) e chama o processador
 * imediatamente — não espera o cron.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { processPurchaseEvent } from "@/lib/auto-enroll";

export type KiwifyPayload = Record<string, unknown>;

export type EnrollResult =
  | { ok: true; eventId: string; result: unknown }
  | { ok: true; eventId: string; queued: true; warning: string }
  | { ok: false; error: string; ignored?: boolean; eventType?: string | null };

interface EnrollOpts {
  /** Cohort onde o aluno será matriculado. */
  cohortId: string;
  /** Override opcional da duração da matrícula (dias). */
  durationDaysOverride?: number | null;
  /** Identificador da plataforma — guardado em purchase_events.platform. */
  platform: "kiwify-direct" | "kiwify-affiliate";
}

/**
 * Processa o payload Kiwify e dispara matrícula. Idempotente.
 * Se o evento não nos interessa (pix_created, etc.) retorna `ignored: true`.
 */
export async function enrollBuyerFromKiwifyPayload(
  sb: SupabaseClient,
  payload: KiwifyPayload,
  opts: EnrollOpts,
): Promise<EnrollResult> {
  const eventType =
    typeof payload.webhook_event_type === "string"
      ? payload.webhook_event_type
      : null;

  const event = mapKiwifyEvent(eventType);
  if (!event) {
    return { ok: false, error: "Evento ignorado.", ignored: true, eventType };
  }

  const customer = (payload.Customer ?? payload.customer ?? {}) as Record<
    string,
    unknown
  >;
  const product = (payload.Product ?? payload.product ?? {}) as Record<
    string,
    unknown
  >;
  const commissions = (payload.Commissions ?? payload.commissions ?? {}) as Record<
    string,
    unknown
  >;

  const email =
    (typeof customer.email === "string" ? customer.email : null)?.trim().toLowerCase() ??
    null;
  if (!email) {
    return { ok: false, error: "Email do cliente não encontrado no payload." };
  }

  const fullName =
    (typeof customer.full_name === "string" ? customer.full_name : null) ??
    (typeof customer.first_name === "string" ? customer.first_name : null) ??
    null;
  const phone =
    typeof customer.mobile === "string"
      ? customer.mobile
      : typeof customer.phone === "string"
        ? customer.phone
        : null;
  const productName =
    typeof product.product_name === "string"
      ? product.product_name
      : typeof payload.product_name === "string"
        ? payload.product_name
        : null;

  const orderId =
    typeof payload.order_id === "string"
      ? payload.order_id
      : typeof payload.order_ref === "string"
        ? payload.order_ref
        : null;
  if (!orderId) {
    return { ok: false, error: "order_id não encontrado no payload." };
  }

  const transactionRowId = hashStringToBigInt(`${opts.platform}:${orderId}`);

  const valueCents =
    typeof commissions.charge_amount === "number"
      ? commissions.charge_amount
      : typeof payload.charge_amount === "number"
        ? payload.charge_amount
        : null;

  const { data: inserted, error: insErr } = await sb
    .schema("membros")
    .from("purchase_events")
    .upsert(
      {
        transaction_row_id: transactionRowId,
        external_transaction_id: orderId,
        platform: opts.platform,
        event,
        email,
        full_name: fullName,
        phone,
        product_name: productName,
        offer_name: null,
        payment_total_value: valueCents ? valueCents / 100 : null,
        status: "pending",
        matched_cohort_id: opts.cohortId,
        error_message: null,
      },
      { onConflict: "transaction_row_id,event" },
    )
    .select("id")
    .single();

  if (insErr) {
    return { ok: false, error: `Falha ao enfileirar: ${insErr.message}` };
  }

  const eventRowId = (inserted as { id: string }).id;

  try {
    const result = await processPurchaseEventForcedCohort(
      sb,
      eventRowId,
      opts.cohortId,
      opts.durationDaysOverride ?? null,
    );
    return { ok: true, eventId: eventRowId, result };
  } catch (e) {
    console.error("[enroll-buyer] erro no process:", e);
    return {
      ok: true,
      eventId: eventRowId,
      queued: true,
      warning: e instanceof Error ? e.message : "Erro no processamento.",
    };
  }
}

function mapKiwifyEvent(
  webhookEventType: string | null,
): "Compra Aprovada" | "Compra Reembolsada" | "Compra Cancelada" | null {
  if (!webhookEventType) return null;
  const t = webhookEventType.toLowerCase();
  if (t === "order_approved") return "Compra Aprovada";
  if (t === "order_refunded" || t === "chargeback") return "Compra Reembolsada";
  if (
    t === "subscription_canceled" ||
    t === "subscription_renewal_canceled" ||
    t === "order_rejected"
  ) {
    return "Compra Cancelada";
  }
  return null;
}

/**
 * Hash determinístico string → BIGINT positivo (pra usar como
 * transaction_row_id quando não temos uma row real em transactions_data).
 *
 * Offset alto pra não colidir com row_ids reais de transactions_data
 * (que começam em 1).
 */
function hashStringToBigInt(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) + 1_000_000_000_000;
}

/**
 * Garante que o produto está no product_cohort_map (ad-hoc) antes de chamar
 * processPurchaseEvent — que sempre consulta o mapping. Idempotente.
 */
async function processPurchaseEventForcedCohort(
  sb: SupabaseClient,
  eventId: string,
  forcedCohortId: string,
  durationDaysOverride: number | null,
) {
  const { data: ev } = await sb
    .schema("membros")
    .from("purchase_events")
    .select("product_name")
    .eq("id", eventId)
    .single();

  const productName = (ev as { product_name: string | null } | null)
    ?.product_name?.toLowerCase().trim();

  if (productName) {
    const { data: existingMap } = await sb
      .schema("membros")
      .from("product_cohort_map")
      .select("id")
      .ilike("product_name_pattern", productName)
      .maybeSingle();

    if (!existingMap) {
      await sb.schema("membros").from("product_cohort_map").insert({
        product_name_pattern: productName,
        cohort_id: forcedCohortId,
        default_expires_days: durationDaysOverride,
        is_active: true,
        notes: "Auto-criado via webhook Kiwify",
      });
    }
  }

  return await processPurchaseEvent(eventId);
}
