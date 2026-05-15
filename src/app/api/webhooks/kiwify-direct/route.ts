import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { enrollBuyerFromKiwifyPayload } from "@/lib/affiliates/enroll-buyer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Webhook direto da Kiwify pra produtos NÃO presentes em
 * `public.transactions_data` (LTA 1.0 antigo, etc.).
 *
 * Diferente do `/api/webhooks/kiwify` (que rastreia vendas de afiliado +
 * dispara matrícula pros 2 produtos da área de membros) e do trigger em
 * `transactions_data` (que depende do n8n popular a tabela), este endpoint
 * vai DIRETO da Kiwify pra membros: enfileira em `purchase_events` com
 * cohort fixa via query string e o processador existente cuida do resto.
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
        error: "cohort_id é obrigatório na URL (?cohort_id=UUID_DA_TURMA).",
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

  const sb = createAdminClient();
  const result = await enrollBuyerFromKiwifyPayload(sb, payload, {
    cohortId,
    durationDaysOverride: durationDays,
    platform: "kiwify-direct",
  });

  if (!result.ok) {
    if (result.ignored) {
      return NextResponse.json({ ok: true, ignored: true, eventType: result.eventType });
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
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
