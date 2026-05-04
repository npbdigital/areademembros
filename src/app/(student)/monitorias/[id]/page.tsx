import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ChevronLeft, Clock, ExternalLink, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeBrt } from "@/lib/format-date";
import { buildZoomJoinUrl, computeLiveStatus } from "@/lib/live-sessions";

export const dynamic = "force-dynamic";

interface SessionRow {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  zoom_meeting_id: string;
  zoom_password: string | null;
  status: string;
  ended_at: string | null;
}

export default async function MonitoriaPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS já gateia: aluno só vê monitoria de cohort em que está matriculado
  const { data: sessionRow } = await supabase
    .schema("membros")
    .from("live_sessions")
    .select(
      "id, title, description, scheduled_at, duration_minutes, zoom_meeting_id, zoom_password, status, ended_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  const session = sessionRow as SessionRow | null;
  if (!session) notFound();

  const status = computeLiveStatus(session);
  const joinUrl = buildZoomJoinUrl(session.zoom_meeting_id, session.zoom_password);
  const durationMin = session.duration_minutes ?? 90;
  const scheduledEndIso = session.scheduled_at
    ? new Date(
        new Date(session.scheduled_at).getTime() + durationMin * 60_000,
      ).toISOString()
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/monitorias"
        className="inline-flex items-center gap-1 text-sm text-npb-text-muted hover:text-npb-gold"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar para monitorias
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          {status === "live" && (
            <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-red-400">
              🔴 AO VIVO
            </span>
          )}
          {status === "scheduled" && (
            <span className="inline-flex items-center gap-1 rounded bg-npb-bg3 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-npb-text-muted">
              <Calendar className="h-3 w-3" />
              Agendada
            </span>
          )}
          {status === "ended" && (
            <span className="inline-flex items-center gap-1 rounded bg-npb-bg3 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-npb-text-muted">
              Encerrada
            </span>
          )}
          {status === "cancelled" && (
            <span className="inline-flex items-center gap-1 rounded bg-npb-bg3 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-npb-text-muted">
              Cancelada
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-npb-text md:text-3xl">
          {session.title}
        </h1>
        {session.description && (
          <p className="mt-2 text-sm text-npb-text-muted">
            {session.description}
          </p>
        )}
      </header>

      {status === "live" && (
        <div className="rounded-2xl border border-red-500/40 bg-gradient-to-br from-red-500/15 to-transparent p-6 text-center sm:p-8">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20">
            <Video className="h-6 w-6 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-npb-text">
            Está rolando agora!
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-npb-text-muted">
            Toque no botão abaixo pra entrar pelo app do Zoom — vídeo, áudio e
            chat funcionam de boa em qualquer dispositivo.
          </p>
          <a
            href={joinUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-md bg-npb-gold px-4 py-3 text-sm font-bold text-black hover:bg-npb-gold-light"
          >
            <ExternalLink className="h-4 w-4" />
            Entrar no Zoom
          </a>
          <SessionTimingInfo
            scheduledAtIso={session.scheduled_at}
            durationMin={durationMin}
          />
        </div>
      )}

      {status === "scheduled" && (
        <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-8 text-center">
          <Clock className="mx-auto h-10 w-10 text-npb-gold opacity-60" />
          <h2 className="mt-3 text-lg font-bold text-npb-text">
            Aguardando início
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-npb-text-muted">
            A monitoria vai começar no horário programado. Você vai receber uma
            notificação push assim que estiver no ar — pode deixar essa página
            aberta ou voltar depois.
          </p>
          <SessionTimingInfo
            scheduledAtIso={session.scheduled_at}
            durationMin={durationMin}
          />
        </div>
      )}

      {(status === "ended" || status === "cancelled") && (
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-8 text-center">
          <h2 className="text-lg font-bold text-npb-text">
            {status === "ended" ? "Monitoria encerrada" : "Monitoria cancelada"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-npb-text-muted">
            {status === "ended"
              ? scheduledEndIso
                ? `Terminou em ${formatDateTimeBrt(scheduledEndIso)}.`
                : "Esta monitoria já foi encerrada."
              : "Esta monitoria foi cancelada antes do horário."}
          </p>
        </div>
      )}
    </div>
  );
}

function SessionTimingInfo({
  scheduledAtIso,
  durationMin,
}: {
  scheduledAtIso: string | null;
  durationMin: number;
}) {
  if (!scheduledAtIso) return null;
  return (
    <p className="mt-4 inline-flex items-center gap-2 text-xs text-npb-text-muted">
      <Clock className="h-3.5 w-3.5" />
      {formatDateTimeBrt(scheduledAtIso)} · {durationMin} min
    </p>
  );
}
