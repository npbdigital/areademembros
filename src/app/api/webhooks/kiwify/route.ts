import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { processSalesRaw } from "@/lib/affiliates/process";
import { verifyKiwifySignature } from "@/lib/affiliates/hmac";
import { enrollBuyerFromKiwifyPayload } from "@/lib/affiliates/enroll-buyer";

/**
 * Allowlist de produtos Kiwify que matriculam o COMPRADOR na área de
 * membros (além do XP pro afiliado vendedor). Filtro por product_id
 * (estável a renomeações). Outros produtos: só XP, sem matrícula.
 *
 * product_id (Kiwify) → cohort_id (membros).
 */
const ENROLLMENT_PRODUCTS: Record<string, string> = {
  // Low Ticket Automático 2
  "8a28d1e0-23c0-11f1-86d3-2bbea225a8b1": "c4067a2f-3e6f-4eef-acae-ecb1e44d608a",
  // Dólar Todo Dia
  "8970da40-23c5-11f1-b5d3-ff15160a5d5f": "d52774b6-b06e-49e3-9efc-d0318bfddb73",
};

/**
 * Webhook Kiwify — Fase B (recebe + processa).
 *
 * Pipeline:
 *  1. Valida ?token=... contra KIWIFY_WEBHOOK_TOKEN (autenticidade básica)
 *  2. Tenta validar HMAC-SHA1 via ?signature=... usando KIWIFY_WEBHOOK_SECRET
 *     (campo "Token" da Kiwify). Sem secret configurado → pula HMAC.
 *     Sem signature na query → segue (Kiwify pode mudar). Inválido → rejeita.
 *  3. Salva tudo em afiliados.sales_raw (raw_payload + raw_headers + query)
 *  4. Chama processSalesRaw em background (cria afiliados.sales, atribui
 *     XP, dispara conquistas)
 *  5. Se o product_id está em ENROLLMENT_PRODUCTS, dispara matrícula do
 *     comprador (via enrollBuyerFromKiwifyPayload). Cobre o caso onde
 *     afiliado Kiwify vende nosso produto e o n8n da transactions_data
 *     não pega.
 *  6. Retorna 200 sempre (mesmo com erro de processamento — Kiwify não
 *     deve reenviar, a gente vê pelos logs e marca processed=false)
 *
 * 2 env vars distintos:
 *  - KIWIFY_WEBHOOK_TOKEN: o segredo no `?token=` da URL configurada na Kiwify
 *  - KIWIFY_WEBHOOK_SECRET: o "Token" mostrado no painel da Kiwify (HMAC).
 *    Se ausente, fallback pra KIWIFY_WEBHOOK_TOKEN por compat.
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const expectedToken = process.env.KIWIFY_WEBHOOK_TOKEN;

  if (!expectedToken) {
    console.error("[kiwify webhook] KIWIFY_WEBHOOK_TOKEN não configurado");
    return NextResponse.json(
      { ok: false, error: "Webhook não configurado." },
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

  // Headers brutos (auditoria + investigar futuras mudanças do contrato Kiwify)
  const headersObj: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headersObj[key] = value;
  });

  // Lê o body cru ANTES de parsear — necessário pra HMAC bater certinho
  const rawText = await req.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = { _raw_text: rawText };
  }

  // Validação HMAC (defesa em camada). Secret separado do token de URL —
  // a Kiwify mostra esses valores em campos diferentes do painel.
  const signature = url.searchParams.get("signature");
  const hmacSecret = process.env.KIWIFY_WEBHOOK_SECRET ?? expectedToken;
  const sigCheck = verifyKiwifySignature({
    rawBody: rawText,
    signature,
    secret: hmacSecret,
  });
  if (sigCheck === false) {
    // Assinatura PRESENTE mas INVÁLIDA — rejeita (não é Kiwify ou foi adulterado)
    console.warn(
      "[kiwify webhook] HMAC inválido — possível tentativa de forjar webhook",
    );
    return NextResponse.json(
      { ok: false, error: "Assinatura inválida." },
      { status: 401 },
    );
  }
  // sigCheck === null = sem signature na query (aceita: kiwify pode mudar)
  // sigCheck === true = signature válida (continua)

  // Extrai campos top-level pra busca rápida
  const p = (parsed ?? {}) as Record<string, unknown>;
  const orderId =
    typeof p.order_id === "string"
      ? p.order_id
      : typeof p.order_ref === "string"
        ? p.order_ref
        : null;
  const eventType =
    typeof p.webhook_event_type === "string" ? p.webhook_event_type : null;
  const status =
    typeof p.order_status === "string" ? p.order_status : null;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  let rawId: string | null = null;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .schema("afiliados")
      .from("sales_raw")
      .insert({
        source: "kiwify",
        webhook_event_type: eventType,
        order_id: orderId,
        status,
        raw_payload: parsed,
        raw_headers: headersObj,
        query_string: url.search || null,
        ip_address: ip,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[kiwify webhook] erro ao salvar raw:", error.message);
      return NextResponse.json({ ok: false, logged: false }, { status: 200 });
    }
    rawId = (data as { id: string }).id;
  } catch (e) {
    console.error("[kiwify webhook] exceção salvando raw:", e);
    return NextResponse.json({ ok: false, logged: false }, { status: 200 });
  }

  // Processa em paralelo (sem aguardar) — webhook responde rápido pra Kiwify
  // não dar timeout. Em serverless (Vercel), o `await` é necessário pra não
  // matar o handler. Trade-off: webhook fica ~50-200ms mais lento.
  if (rawId) {
    try {
      await processSalesRaw(rawId);
    } catch (e) {
      console.error("[kiwify webhook] erro no process:", e);
      // não falha — raw já está salvo, dá pra reprocessar manualmente
    }
  }

  // Matrícula: só dispara pros 2 produtos da nossa área de membros
  // (LTA 2 e DTD). Outros produtos vendidos por afiliados continuam só
  // com XP, sem entrar em purchase_events.
  const productId =
    (parsed as { Product?: { product_id?: string } } | null)?.Product
      ?.product_id ?? null;
  const cohortForEnrollment = productId ? ENROLLMENT_PRODUCTS[productId] : null;

  if (cohortForEnrollment) {
    try {
      const sb = createAdminClient();
      const enrollResult = await enrollBuyerFromKiwifyPayload(
        sb,
        parsed as Record<string, unknown>,
        {
          cohortId: cohortForEnrollment,
          platform: "kiwify-affiliate",
        },
      );
      if (!enrollResult.ok && !enrollResult.ignored) {
        console.error(
          "[kiwify webhook] falha matrícula:",
          enrollResult.error,
        );
      }
    } catch (e) {
      console.error("[kiwify webhook] exceção matrícula:", e);
      // não falha o webhook — Kiwify não deve reenviar
    }
  }

  return NextResponse.json({ ok: true });
}

// GET pra healthcheck rápido (acessível direto no browser)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tokenFromQuery = url.searchParams.get("token");
  const expected = process.env.KIWIFY_WEBHOOK_TOKEN;

  if (!expected) {
    return NextResponse.json({ ok: false, error: "Não configurado" });
  }
  if (tokenFromQuery !== expected) {
    return NextResponse.json({ ok: false, error: "Token inválido" });
  }
  return NextResponse.json({
    ok: true,
    message: "Webhook Kiwify pronto. Use POST pra enviar eventos.",
  });
}
