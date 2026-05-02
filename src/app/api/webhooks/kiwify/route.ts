import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Webhook Kiwify — Fase A (só captura/log).
 *
 * Estratégia:
 * - Aceita POST com body JSON
 * - Valida ?token=... contra KIWIFY_WEBHOOK_TOKEN (env var)
 * - Salva o payload completo + headers + query string em afiliados.sales_raw
 * - Retorna 200 OK sempre que conseguir gravar (mesmo se algo falhar no parse,
 *   a gente NÃO devolve erro pra Kiwify não ficar reenviando — investigamos
 *   pelo log no banco)
 *
 * Quando tivermos dados reais, a Fase B vai processar (vincular ao aluno,
 * atribuir XP, criar conquistas).
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const expected = process.env.KIWIFY_WEBHOOK_TOKEN;

  // Token vindo da query string (?token=XXX) — formato Kiwify suporta
  const tokenFromQuery = url.searchParams.get("token");

  if (!expected) {
    console.error("[kiwify webhook] KIWIFY_WEBHOOK_TOKEN não configurado");
    return NextResponse.json(
      { ok: false, error: "Webhook não configurado." },
      { status: 500 },
    );
  }

  if (!tokenFromQuery || tokenFromQuery !== expected) {
    return NextResponse.json(
      { ok: false, error: "Token inválido." },
      { status: 401 },
    );
  }

  // Captura headers brutos pra investigar HMAC/signature da Kiwify
  const headersObj: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headersObj[key] = value;
  });

  // Lê body cru e tenta parsear como JSON. Se falhar, salva como texto.
  const rawText = await req.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = { _raw_text: rawText };
  }

  // Extrai campos top-level conhecidos pra busca rápida no banco
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

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
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
      });

    if (error) {
      console.error("[kiwify webhook] erro ao salvar:", error.message);
      // Mesmo com erro, retorna 200 pra Kiwify não reenviar — a gente vê
      // pelo log do servidor que algo deu errado e investiga
      return NextResponse.json({ ok: false, logged: false }, { status: 200 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[kiwify webhook] exceção:", e);
    return NextResponse.json({ ok: false, logged: false }, { status: 200 });
  }
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
