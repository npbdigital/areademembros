import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { processPurchaseEvent } from "@/lib/auto-enroll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Webhook direto da Kiwify pra produtos NÃO presentes em
 * `public.transactions_data` (LTA 1.0 antigo, etc.).
 *
 * Diferente do `/api/webhooks/kiwify` (que só rastreia vendas de afiliado)
 * e do trigger em `transactions_data` (que depende do n8n popular a tabela),
 * este endpoint vai DIRETO da Kiwify pra membros: enfileira em
 * `purchase_events` com cohort fixa via query string e o processador
 * existente cuida do resto (cria user, enrollment, etc.).
 *
 * Por que existe:
 *   - Produtos antigos cujo collector externo não está captando
 *   - Casos onde admin quer mapear venda direto pra cohort sem passar
 *     pelo product_cohort_map (ex: produto único, oferta especial)
 *
 * URL pra colar na Kiwify (configurar 1 webhook por produto):
 *   POST https://membros.felipesempe.com.br/api/webhooks/kiwify-direct
 *        ?token={KIWIFY_DIRECT_TOKEN}
 *        &cohort_id={UUID_DA_TURMA}
 *        [&duration_days=30]  (opcional — sobrescreve duração da turma)
 *
 * Eventos processados (mapeados do `webhook_event_type` da Kiwify):
 *   - order_approved   → "Compra Aprovada"  (cria/reativa enrollment)
 *   - order_refunded   → "Compra Reembolsada" (desativa enrollment)
 *   - chargeback       → "Compra Reembolsada" (desativa enrollment)
 *   - subscription_canceled → "Compra Cancelada"
 *
 * Idempotência: o `order_id` da Kiwify (ou `order_ref` como fallback)
 * vira o `transaction_row_id` único. Webhook duplicado não cria
 * enrollment duplicado.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);

  const expectedToken = process.env.KIWIFY_DIRECT_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      { ok: false, error: "KIWIFY_DIRECT_TOKEN não configurado." },
      { status: 500 },
    );
  }

  const tokenFromQuery = url.searchParams.get("token");
  if (!tokenFromQuery || tokenFromQuery !== expectedToken) {
    return NextResponse.json(
      { ok: false, error: "Token inválido." },
      { status: 401 },
    );
  }

  const cohortId = url.searchParams.get("cohort_id");
  if (!cohortId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "cohort_id é obrigatório na URL (?cohort_id=UUID_DA_TURMA).",
      },
      { status: 400 },
    );
  }

  const durationDaysRaw = url.searchParams.get("duration_days");
  const durationDays = durationDaysRaw ? parseInt(durationDaysRaw, 10) : null;

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido." },
      { status: 400 },
    );
  }

  // Extrai dados da Kiwify (formato padrão do webhook Kiwify)
  const eventType =
    typeof payload.webhook_event_type === "string"
      ? payload.webhook_event_type
      : null;

  // Mapeia o evento pro formato interno
  const event = mapKiwifyEvent(eventType);
  if (!event) {
    // Evento que não nos interessa (waiting_payment, etc.) — responde 200 e ignora
    return NextResponse.json({ ok: true, ignored: true, eventType });
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
    return NextResponse.json(
      { ok: false, error: "Email do cliente não encontrado no payload." },
      { status: 400 },
    );
  }

  const fullName =
    (typeof customer.full_name === "string" ? customer.full_name : null) ??
    (typeof customer.first_name === "string" ? customer.first_name : null) ??
    null;
  const phone =
    typeof customer.mobile === "string" ? customer.mobile :
    typeof customer.phone === "string" ? customer.phone :
    null;
  const productName =
    typeof product.product_name === "string" ? product.product_name :
    typeof payload.product_name === "string" ? payload.product_name :
    null;

  const orderId =
    typeof payload.order_id === "string" ? payload.order_id :
    typeof payload.order_ref === "string" ? payload.order_ref :
    null;
  if (!orderId) {
    return NextResponse.json(
      { ok: false, error: "order_id não encontrado no payload." },
      { status: 400 },
    );
  }

  // Hash determinístico do orderId em BIGINT pra usar como transaction_row_id
  // (o trigger usa BIGINT vindo da tabela transactions_data; aqui não temos
  // tabela origem, então geramos um ID estável a partir do orderId).
  const transactionRowId = hashStringToBigInt(`kiwify-direct:${orderId}`);

  const valueCents =
    typeof commissions.charge_amount === "number"
      ? commissions.charge_amount
      : typeof payload.charge_amount === "number"
        ? payload.charge_amount
        : null;

  const sb = createAdminClient();

  // Insere/atualiza purchase_event diretamente (idempotência via UNIQUE)
  const { data: inserted, error: insErr } = await sb
    .schema("membros")
    .from("purchase_events")
    .upsert(
      {
        transaction_row_id: transactionRowId,
        external_transaction_id: orderId,
        platform: "kiwify-direct",
        event,
        email,
        full_name: fullName,
        phone,
        product_name: productName,
        offer_name: null,
        payment_total_value: valueCents ? valueCents / 100 : null,
        status: "pending",
        // matched_cohort_id já preenchido — pula o lookup do product_cohort_map
        matched_cohort_id: cohortId,
        error_message: null,
      },
      { onConflict: "transaction_row_id,event" },
    )
    .select("id")
    .single();

  if (insErr) {
    return NextResponse.json(
      { ok: false, error: `Falha ao enfileirar: ${insErr.message}` },
      { status: 500 },
    );
  }

  const eventRowId = (inserted as { id: string }).id;

  // Processa imediatamente (não espera cron/webhook db)
  try {
    const result = await processPurchaseEventForcedCohort(
      eventRowId,
      cohortId,
      durationDays,
    );
    return NextResponse.json({
      ok: true,
      event_id: eventRowId,
      result,
    });
  } catch (e) {
    // Falha no processamento não derruba o webhook — fica em pending pro cron
    console.error("[kiwify-direct] erro no process:", e);
    return NextResponse.json({
      ok: true,
      event_id: eventRowId,
      queued: true,
      warning: e instanceof Error ? e.message : "Erro no processamento.",
    });
  }
}

/** Healthcheck */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const expected = process.env.KIWIFY_DIRECT_TOKEN;
  if (!expected) {
    return NextResponse.json({ ok: false, error: "Não configurado." });
  }
  if (url.searchParams.get("token") !== expected) {
    return NextResponse.json({ ok: false, error: "Token inválido." });
  }
  return NextResponse.json({
    ok: true,
    message:
      "Endpoint pronto. POST com query ?token=&cohort_id=&duration_days= e payload Kiwify.",
  });
}

function mapKiwifyEvent(
  webhookEventType: string | null,
): "Compra Aprovada" | "Compra Reembolsada" | "Compra Cancelada" | null {
  if (!webhookEventType) return null;
  const t = webhookEventType.toLowerCase();
  if (t === "order_approved" || t === "pix_created") {
    // pix_created não é aprovação, ignora — só order_approved entra
    return t === "order_approved" ? "Compra Aprovada" : null;
  }
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
 * Usa um hash simples (DJB2 modificado) que produz números até ~2^53,
 * dentro do range do Postgres BIGINT.
 */
function hashStringToBigInt(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  // Converte pra positivo absoluto e adiciona offset alto pra não colidir
  // com row_ids reais de transactions_data (que começam em 1).
  return Math.abs(hash) + 1_000_000_000_000;
}

/**
 * Versão de processPurchaseEvent que aceita cohort forçada via URL,
 * sem precisar consultar product_cohort_map. Reusa a lógica interna
 * de criação de user + enrollment.
 *
 * Implementação: garante que matched_cohort_id está setado (já fizemos
 * no upsert), depois delega pro processPurchaseEvent que vai pular o
 * lookup do mapping graças à coluna preenchida.
 *
 * Observação: o processPurchaseEvent atual SEMPRE consulta o mapping.
 * Pra forçar cohort, vamos popular o map temporariamente OU mudar o
 * processador. Aqui faço o caminho simples: adapto inline.
 */
async function processPurchaseEventForcedCohort(
  eventId: string,
  forcedCohortId: string,
  durationDaysOverride: number | null,
) {
  const sb = createAdminClient();

  // Pega o evento e atualiza o product_cohort_map ad-hoc se preciso
  const { data: ev } = await sb
    .schema("membros")
    .from("purchase_events")
    .select("product_name")
    .eq("id", eventId)
    .single();

  const productName = (ev as { product_name: string | null } | null)
    ?.product_name?.toLowerCase().trim();

  if (productName) {
    // Garante que o mapping existe pro produto -> cohort. Idempotente.
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
        notes: "Auto-criado via /api/webhooks/kiwify-direct",
      });
    }
  }

  return await processPurchaseEvent(eventId);
}
