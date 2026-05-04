import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  isAutoEnrollmentEnabled,
  processPurchaseEvent,
} from "@/lib/auto-enroll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron de fallback — varre purchase_events com status='pending' e processa.
 *
 * Por que existe: o caminho principal é o Supabase Database Webhook que
 * dispara o endpoint /api/internal/process-purchase em ~3s. MAS se o
 * webhook do Supabase falhar (Vercel down, retry esgotado, evento perdido),
 * esses eventos ficam parados em 'pending'. Esse cron pega o que ficou
 * pra trás.
 *
 * Cadência: 5min (vercel.json).
 *
 * Limita a 100 eventos por execução pra não estourar o maxDuration de 60s.
 * Se houver fila grande (raro), processa nas próximas execuções.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const sb = createAdminClient();

  // Respeita o toggle global — se desligado, nem busca a fila
  const enabled = await isAutoEnrollmentEnabled(sb);
  if (!enabled) {
    return NextResponse.json({
      ok: true,
      enabled: false,
      message: "auto_enrollment_enabled=false; cron noop.",
    });
  }

  // Pega os pendentes mais antigos primeiro
  const { data: rows } = await sb
    .schema("membros")
    .from("purchase_events")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);

  const ids = ((rows ?? []) as Array<{ id: string }>).map((r) => r.id);

  let processed = 0;
  let unmapped = 0;
  let failed = 0;

  for (const id of ids) {
    try {
      const r = await processPurchaseEvent(id);
      if (r.status === "processed") processed++;
      else if (r.status === "unmapped") unmapped++;
      else if (r.status === "failed") failed++;
    } catch (e) {
      console.error("[cron process-pending] erro evento", id, e);
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: ids.length,
    processed,
    unmapped,
    failed,
  });
}
