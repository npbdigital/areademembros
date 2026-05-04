import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { processPurchaseEvent } from "@/lib/auto-enroll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Endpoint chamado pelo Supabase Database Webhook quando uma linha é
 * INSERTADA em `membros.purchase_events` (que por sua vez foi populada
 * pelo trigger SQL em public.transactions_data).
 *
 * Auth: header `Authorization: Bearer ${INTERNAL_API_TOKEN}`.
 *
 * Body do Supabase Database Webhook (formato padrão):
 *   {
 *     "type": "INSERT",
 *     "table": "purchase_events",
 *     "schema": "membros",
 *     "record": { ...row recém-inserida... },
 *     "old_record": null
 *   }
 *
 * Aceita também body simples `{ event_id }` pra reprocessamento manual.
 *
 * Latência alvo: ~2-5s do INSERT até o user estar matriculado.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_API_TOKEN não configurado." },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json(
      { ok: false, error: "Token inválido." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido." },
      { status: 400 },
    );
  }

  // Aceita os dois formatos: webhook do Supabase ou call direto
  let eventId: string | null = null;

  if (body.record && typeof body.record === "object") {
    eventId = ((body.record as Record<string, unknown>).id ?? null) as
      | string
      | null;
  } else if (typeof body.event_id === "string") {
    eventId = body.event_id;
  }

  if (!eventId) {
    return NextResponse.json(
      { ok: false, error: "event_id ou record.id obrigatório." },
      { status: 400 },
    );
  }

  try {
    const result = await processPurchaseEvent(eventId);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** GET pra healthcheck. */
export async function GET(req: NextRequest) {
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_API_TOKEN não configurado." },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json(
      { ok: false, error: "Token inválido." },
      { status: 401 },
    );
  }
  // Mostra contagem de eventos pendentes pra healthcheck rápido
  const sb = createAdminClient();
  const { count } = await sb
    .schema("membros")
    .from("purchase_events")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return NextResponse.json({
    ok: true,
    pending_count: count ?? 0,
    message: "Endpoint pronto. POST { event_id } ou record do Supabase webhook.",
  });
}
