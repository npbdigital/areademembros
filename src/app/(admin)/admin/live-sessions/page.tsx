import Link from "next/link";
import { ArrowLeft, Plus, Radio, Repeat } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { LiveSessionRowActions } from "@/components/admin/live-session-row-actions";
import { CreateLiveSessionForm } from "@/components/admin/create-live-session-form";
import { formatDateTimeBrt } from "@/lib/format-date";

export const dynamic = "force-dynamic";

interface SessionRow {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  zoom_meeting_id: string;
  zoom_password: string | null;
  status: string;
  recurrence: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

const RECURRENCE_LABEL: Record<string, string> = {
  daily: "Diariamente",
  weekly: "Semanalmente",
  biweekly: "Quinzenalmente",
  monthly: "Mensalmente",
};

export default async function AdminLiveSessionsPage() {
  const sb = createAdminClient();

  const [
    { data: sessionsData },
    { data: cohortsData },
    { data: linkRows },
    { data: cohortCoursesData },
  ] = await Promise.all([
    sb
      .schema("membros")
      .from("live_sessions")
      .select(
        "id, title, description, scheduled_at, zoom_meeting_id, zoom_password, status, recurrence, started_at, ended_at, created_at",
      )
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    sb.schema("membros").from("cohorts").select("id, name").order("name"),
    sb
      .schema("membros")
      .from("live_session_cohorts")
      .select("session_id, cohort_id"),
    // Cursos atrelados a cada turma — vira "hint" do combobox
    sb
      .schema("membros")
      .from("cohort_courses")
      .select("cohort_id, courses(title)"),
  ]);

  const sessions = (sessionsData ?? []) as SessionRow[];
  const cohorts = (cohortsData ?? []) as Array<{ id: string; name: string }>;
  const cohortMap = new Map(cohorts.map((c) => [c.id, c.name]));

  // Mapa cohort_id → string com cursos ("Curso A · Curso B")
  const courseHintByCohort = new Map<string, string>();
  for (const row of (cohortCoursesData ?? []) as Array<{
    cohort_id: string;
    courses: { title: string } | { title: string }[] | null;
  }>) {
    const courseObj = Array.isArray(row.courses) ? row.courses[0] : row.courses;
    if (!courseObj) continue;
    const existing = courseHintByCohort.get(row.cohort_id);
    courseHintByCohort.set(
      row.cohort_id,
      existing ? `${existing} · ${courseObj.title}` : courseObj.title,
    );
  }

  const cohortOptions = cohorts.map((c) => ({
    id: c.id,
    name: c.name,
    hint: courseHintByCohort.get(c.id),
  }));

  // Mapa session_id → array de cohort names
  const sessionCohorts = new Map<string, string[]>();
  for (const row of (linkRows ?? []) as Array<{
    session_id: string;
    cohort_id: string;
  }>) {
    const arr = sessionCohorts.get(row.session_id) ?? [];
    const name = cohortMap.get(row.cohort_id);
    if (name) arr.push(name);
    sessionCohorts.set(row.session_id, arr);
  }

  const live = sessions.filter((s) => s.status === "live");
  const scheduled = sessions.filter((s) => s.status === "scheduled");
  const past = sessions.filter(
    (s) => s.status === "ended" || s.status === "cancelled",
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center gap-1 text-sm text-npb-text-muted hover:text-npb-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <header>
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
          <Radio className="h-3.5 w-3.5" />
          Monitorias ao vivo
        </div>
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          Lives via Zoom
        </h1>
        <p className="mt-1 text-sm text-npb-text-muted">
          Aluno só vê monitoria das turmas em que está matriculado. A
          liberação é manual: clique <strong>Iniciar agora</strong> no horário
          que você quiser começar — alunos das turmas recebem notificação push
          na hora. Se for recorrente, ao encerrar criamos a próxima
          ocorrência automaticamente.
        </p>
      </header>

      <section className="rounded-2xl border border-npb-border bg-npb-bg2 p-5">
        <h2 className="mb-3 inline-flex items-center gap-2 text-base font-bold text-npb-text">
          <Plus className="h-4 w-4 text-npb-gold" /> Nova monitoria
        </h2>
        <CreateLiveSessionForm cohorts={cohortOptions} />
      </section>

      {live.length > 0 && (
        <section className="space-y-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-bold text-red-400">
            🔴 Ao vivo agora ({live.length})
          </h2>
          <ul className="space-y-2">
            {live.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                cohortNames={sessionCohorts.get(s.id) ?? []}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-npb-text">
          Agendadas ({scheduled.length})
        </h2>
        {scheduled.length === 0 ? (
          <p className="rounded-xl border border-dashed border-npb-border bg-npb-bg2/40 p-6 text-center text-sm text-npb-text-muted">
            Nenhuma monitoria agendada.
          </p>
        ) : (
          <ul className="space-y-2">
            {scheduled.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                cohortNames={sessionCohorts.get(s.id) ?? []}
              />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-npb-text-muted">
            Encerradas ({past.length})
          </h2>
          <ul className="space-y-2 opacity-70">
            {past.slice(0, 10).map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                cohortNames={sessionCohorts.get(s.id) ?? []}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SessionRow({
  session,
  cohortNames,
}: {
  session: SessionRow;
  cohortNames: string[];
}) {
  const statusBadge =
    session.status === "live"
      ? { label: "🔴 AO VIVO", className: "bg-red-500/20 text-red-400" }
      : session.status === "scheduled"
        ? { label: "AGENDADA", className: "bg-npb-bg3 text-npb-text-muted" }
        : session.status === "ended"
          ? { label: "ENCERRADA", className: "bg-npb-bg3 text-npb-text-muted" }
          : { label: "CANCELADA", className: "bg-npb-bg3 text-npb-text-muted" };

  const recurrenceLabel = RECURRENCE_LABEL[session.recurrence];

  return (
    <li className="rounded-xl border border-npb-border bg-npb-bg2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusBadge.className}`}
            >
              {statusBadge.label}
            </span>
            {cohortNames.map((name) => (
              <span
                key={name}
                className="rounded bg-npb-gold/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-npb-gold"
              >
                {name}
              </span>
            ))}
            {recurrenceLabel && (
              <span className="inline-flex items-center gap-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
                <Repeat className="h-2.5 w-2.5" />
                {recurrenceLabel}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 text-base font-bold text-npb-text">
            {session.title}
          </h3>
          {session.description && (
            <p className="mt-0.5 text-xs text-npb-text-muted line-clamp-2">
              {session.description}
            </p>
          )}
          <p className="mt-1 text-xs text-npb-text-muted">
            {session.scheduled_at && (
              <>
                Previsto: {formatDateTimeBrt(session.scheduled_at)}
                <span className="px-2">·</span>
              </>
            )}
            Meeting ID:{" "}
            <code className="text-npb-gold">{session.zoom_meeting_id}</code>
            {session.zoom_password && (
              <>
                <span className="px-2">·</span>Senha:{" "}
                <code className="text-npb-gold">{session.zoom_password}</code>
              </>
            )}
          </p>
        </div>
        <LiveSessionRowActions
          sessionId={session.id}
          status={session.status}
        />
      </div>
    </li>
  );
}
