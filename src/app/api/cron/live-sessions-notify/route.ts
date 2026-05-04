import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { computeLiveStatus } from "@/lib/live-sessions";
import {
  generateNextRecurrenceIfNeeded,
  notifyLiveSessionStartedIfNeeded,
} from "@/app/(admin)/admin/live-sessions/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron das monitorias — roda a cada 5min (vercel.json).
 *
 * Duas responsabilidades, ambas idempotentes:
 *
 *  1. **Notificação de "ao vivo"** — pra cada sessão que cruzou o
 *     scheduled_at (status computado = 'live') e ainda não notificou
 *     (`live_notified_at IS NULL`), dispara push pra alunos elegíveis e
 *     marca `live_notified_at = now()`.
 *
 *  2. **Recorrência** — pra cada sessão que terminou (status computado =
 *     'ended') com recurrence != 'none' e ainda não criou sucessora
 *     (`successor_created_at IS NULL`), cria a próxima ocorrência da
 *     série e marca `successor_created_at = now()`.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron envia auto).
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
  const now = new Date();

  // Janela ampla pra cobrir as duas tarefas: do passado próximo (sessões
  // que terminaram há pouco e podem precisar gerar sucessora) até o
  // futuro próximo (sessões que vão começar em breve e precisam de notif
  // antes — buffer de 5min do computeLiveStatus).
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const until = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await sb
    .schema("membros")
    .from("live_sessions")
    .select(
      "id, scheduled_at, duration_minutes, status, recurrence, live_notified_at, successor_created_at",
    )
    .gte("scheduled_at", since)
    .lte("scheduled_at", until)
    .neq("status", "cancelled");

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const sessions = (rows ?? []) as Array<{
    id: string;
    scheduled_at: string | null;
    duration_minutes: number | null;
    status: string;
    recurrence: string;
    live_notified_at: string | null;
    successor_created_at: string | null;
  }>;

  let notifiedCount = 0;
  let nextCreatedCount = 0;

  for (const s of sessions) {
    const computed = computeLiveStatus(s, now);

    if (computed === "live" && !s.live_notified_at) {
      try {
        const r = await notifyLiveSessionStartedIfNeeded(s.id);
        if (r.notified > 0) notifiedCount++;
      } catch (e) {
        console.error("[cron live-sessions] notify falhou", s.id, e);
      }
    }

    if (
      computed === "ended" &&
      s.recurrence !== "none" &&
      !s.successor_created_at
    ) {
      try {
        const r = await generateNextRecurrenceIfNeeded(s.id);
        if (r.nextSessionId) nextCreatedCount++;
      } catch (e) {
        console.error("[cron live-sessions] recurrence falhou", s.id, e);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: sessions.length,
    notified: notifiedCount,
    successors_created: nextCreatedCount,
  });
}
