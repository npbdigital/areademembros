import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ZoomEmbedPlayer } from "@/components/student/zoom-embed-player";
import { formatDateTimeBrt } from "@/lib/format-date";

export const dynamic = "force-dynamic";

interface SessionRow {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
}

export default async function MonitoriaPlayerPage({
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
      "id, title, description, scheduled_at, status, started_at, ended_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  const session = sessionRow as SessionRow | null;
  if (!session) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/monitorias"
        className="inline-flex items-center gap-1 text-sm text-npb-text-muted hover:text-npb-gold"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar para monitorias
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          {session.status === "live" && (
            <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-red-400">
              🔴 AO VIVO
            </span>
          )}
          {session.status === "scheduled" && (
            <span className="inline-flex items-center gap-1 rounded bg-npb-bg3 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-npb-text-muted">
              Aguardando início
            </span>
          )}
          {(session.status === "ended" || session.status === "cancelled") && (
            <span className="inline-flex items-center gap-1 rounded bg-npb-bg3 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-npb-text-muted">
              {session.status === "ended" ? "Encerrada" : "Cancelada"}
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
        {session.scheduled_at && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-npb-text-muted">
            <Clock className="h-3.5 w-3.5" />
            Previsto: {formatDateTimeBrt(session.scheduled_at)}
          </p>
        )}
      </header>

      {session.status === "live" ? (
        <ZoomEmbedPlayer sessionId={session.id} />
      ) : session.status === "scheduled" ? (
        <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-10 text-center">
          <Clock className="mx-auto h-10 w-10 text-npb-gold opacity-60" />
          <h2 className="mt-3 text-lg font-bold text-npb-text">
            Aguardando início
          </h2>
          <p className="mt-2 text-sm text-npb-text-muted">
            A monitoria ainda não começou. Você vai receber uma notificação
            push assim que liberar — pode deixar essa página aberta ou voltar
            depois.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-10 text-center">
          <h2 className="text-lg font-bold text-npb-text">
            Monitoria encerrada
          </h2>
          <p className="mt-2 text-sm text-npb-text-muted">
            {session.ended_at
              ? `Encerrou em ${formatDateTimeBrt(session.ended_at)}`
              : "Esta monitoria já foi encerrada."}
          </p>
        </div>
      )}
    </div>
  );
}
