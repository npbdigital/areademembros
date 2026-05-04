import Link from "next/link";
import { CalendarDays, ExternalLink, Radio } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeBrt } from "@/lib/format-date";
import {
  buildZoomJoinUrl,
  computeLiveStatus,
} from "@/lib/live-sessions";
import {
  type CalendarSessionItem,
  MonitoriaCalendar,
} from "@/components/student/monitoria-calendar";

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

export default async function MonitoriasPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS já filtra: só sessões de cohorts em que tem matrícula ativa
  // (admin vê todas). Janela: 60 dias passados a 90 futuros pra calendário
  // ter contexto histórico + planejamento.
  const sinceIso = new Date(
    Date.now() - 60 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const untilIso = new Date(
    Date.now() + 90 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: sessionsData } = await supabase
    .schema("membros")
    .from("live_sessions")
    .select(
      "id, title, description, scheduled_at, duration_minutes, zoom_meeting_id, zoom_password, status, ended_at",
    )
    .gte("scheduled_at", sinceIso)
    .lte("scheduled_at", untilIso)
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  const sessions = (sessionsData ?? []) as SessionRow[];

  const withStatus = sessions
    .filter((s) => s.scheduled_at !== null)
    .map((s) => ({
      session: s,
      status: computeLiveStatus(s),
    }));

  const live = withStatus.filter((x) => x.status === "live");
  const upcoming = withStatus.filter((x) => x.status === "scheduled");

  const calendarItems: CalendarSessionItem[] = withStatus.map((x) => ({
    id: x.session.id,
    title: x.session.title,
    scheduledAt: x.session.scheduled_at!,
    status: x.status,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
          <Radio className="h-3.5 w-3.5" />
          Monitorias ao vivo
        </div>
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          Calendário de monitorias
        </h1>
        <p className="mt-1 text-sm text-npb-text-muted">
          Veja o que está marcado nas suas turmas. No horário marcado, status
          vira <strong className="text-red-400">AO VIVO</strong> e você recebe
          um aviso pra entrar pelo app do Zoom.
        </p>
      </header>

      {live.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-red-400">🔴 Ao vivo agora</h2>
          <ul className="space-y-3">
            {live.map((x) => (
              <LiveCard
                key={x.session.id}
                session={x.session}
                joinUrl={buildZoomJoinUrl(
                  x.session.zoom_meeting_id,
                  x.session.zoom_password,
                )}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-bold text-npb-text">
          <CalendarDays className="h-4 w-4 text-npb-gold" />
          Calendário
        </h2>
        <MonitoriaCalendar sessions={calendarItems} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-npb-text">Próximas</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-8 text-center">
            <Radio className="mx-auto h-8 w-8 text-npb-text-muted opacity-40" />
            <p className="mt-3 text-sm text-npb-text-muted">
              Nenhuma monitoria agendada nos próximos 90 dias.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {upcoming.slice(0, 10).map((x) => (
              <UpcomingRow key={x.session.id} session={x.session} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LiveCard({
  session,
  joinUrl,
}: {
  session: SessionRow;
  joinUrl: string;
}) {
  return (
    <li>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/40 bg-red-500/5 p-5">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-400">
            🔴 AO VIVO
          </span>
          <h3 className="mt-1.5 text-base font-bold text-npb-text">
            {session.title}
          </h3>
          {session.description && (
            <p className="mt-1 text-sm text-npb-text-muted line-clamp-2">
              {session.description}
            </p>
          )}
        </div>
        <a
          href={joinUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md bg-npb-gold px-4 py-2 text-sm font-bold text-black hover:bg-npb-gold-light"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Entrar no Zoom
        </a>
      </div>
    </li>
  );
}

function UpcomingRow({ session }: { session: SessionRow }) {
  return (
    <li>
      <Link
        href={`/monitorias/${session.id}`}
        className="block rounded-xl border border-npb-border bg-npb-bg2 p-4 transition hover:border-npb-gold-dim"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-npb-text">
              {session.title}
            </h3>
            <p className="mt-0.5 text-xs text-npb-text-muted">
              {session.scheduled_at
                ? formatDateTimeBrt(session.scheduled_at)
                : "Sem horário"}
            </p>
          </div>
          <span className="rounded bg-npb-bg3 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-npb-text-muted">
            Agendada
          </span>
        </div>
      </Link>
    </li>
  );
}
