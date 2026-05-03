import Link from "next/link";
import { Radio } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeBrt } from "@/lib/format-date";

export const dynamic = "force-dynamic";

interface SessionRow {
  id: string;
  cohort_id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  status: string;
  started_at: string | null;
}

export default async function MonitoriasPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS já filtra: só sessões de cohorts em que tem matrícula ativa
  // (admin vê todas)
  const { data: sessionsData } = await supabase
    .schema("membros")
    .from("live_sessions")
    .select(
      "id, cohort_id, title, description, scheduled_at, status, started_at",
    )
    .in("status", ["scheduled", "live"])
    .order("status", { ascending: false }) // live primeiro
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  const sessions = (sessionsData ?? []) as SessionRow[];
  const live = sessions.filter((s) => s.status === "live");
  const upcoming = sessions.filter((s) => s.status === "scheduled");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
          <Radio className="h-3.5 w-3.5" />
          Monitorias ao vivo
        </div>
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          Próximas e ao vivo
        </h1>
        <p className="mt-1 text-sm text-npb-text-muted">
          Quando uma monitoria liberar, você vai receber notificação. Clique
          no card pra entrar no Zoom direto pela plataforma.
        </p>
      </header>

      {live.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-red-400">
            🔴 Ao vivo agora
          </h2>
          <ul className="space-y-3">
            {live.map((s) => (
              <SessionCard key={s.id} session={s} live />
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-npb-text">
          Agendadas
        </h2>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-10 text-center">
            <Radio className="mx-auto h-8 w-8 text-npb-text-muted opacity-40" />
            <p className="mt-3 text-sm text-npb-text-muted">
              Nenhuma monitoria agendada no momento. Você será avisado quando
              tiver uma marcada pra sua turma.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SessionCard({
  session,
  live,
}: {
  session: SessionRow;
  live?: boolean;
}) {
  const inner = (
    <div
      className={`rounded-2xl border p-5 transition ${
        live
          ? "border-red-500/40 bg-red-500/5 hover:border-red-500"
          : "border-npb-border bg-npb-bg2 hover:border-npb-gold-dim"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {live ? (
            <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-400">
              🔴 AO VIVO
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-npb-bg3 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-npb-text-muted">
              AGENDADA
            </span>
          )}
          <h3 className="mt-1.5 text-base font-bold text-npb-text">
            {session.title}
          </h3>
          {session.description && (
            <p className="mt-1 text-sm text-npb-text-muted line-clamp-2">
              {session.description}
            </p>
          )}
          <p className="mt-2 text-xs text-npb-text-muted">
            {live && session.started_at
              ? `Começou às ${formatDateTimeBrt(session.started_at)}`
              : session.scheduled_at
                ? `Previsto: ${formatDateTimeBrt(session.scheduled_at)}`
                : "Sem horário previsto"}
          </p>
        </div>
        {live && (
          <span className="flex-shrink-0 rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-white">
            Entrar
          </span>
        )}
      </div>
    </div>
  );
  return live ? (
    <li>
      <Link href={`/monitorias/${session.id}`}>{inner}</Link>
    </li>
  ) : (
    <li>{inner}</li>
  );
}
