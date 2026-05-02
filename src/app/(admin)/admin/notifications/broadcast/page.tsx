import Link from "next/link";
import { ArrowLeft, Megaphone } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { BroadcastForm } from "@/components/admin/broadcast-form";

export const dynamic = "force-dynamic";

export default async function BroadcastPage() {
  const supabase = createAdminClient();

  const [{ data: cohortsRaw }, { data: historyRaw }] = await Promise.all([
    supabase
      .schema("membros")
      .from("cohorts")
      .select("id, name")
      .order("name", { ascending: true }),
    supabase
      .schema("membros")
      .from("push_broadcasts")
      .select(
        "id, title, body, audience, recipients_count, delivered_count, failed_count, created_at, sent_by",
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const cohorts = (cohortsRaw ?? []) as Array<{ id: string; name: string }>;
  const history = (historyRaw ?? []) as Array<{
    id: string;
    title: string;
    body: string | null;
    audience: Record<string, unknown>;
    recipients_count: number;
    delivered_count: number;
    failed_count: number;
    created_at: string;
    sent_by: string | null;
  }>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/admin/community"
          className="inline-flex items-center gap-1 text-sm text-npb-text-muted hover:text-npb-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>
        <h1 className="mt-3 inline-flex items-center gap-2 text-xl font-bold text-npb-text">
          <Megaphone className="h-5 w-5 text-npb-gold" />
          Enviar anúncio
        </h1>
        <p className="text-sm text-npb-text-muted">
          Push + notificação in-app pra alunos selecionados. Use pra avisar
          de live, novo módulo, evento — coisas que valem interromper o aluno.
        </p>
      </div>

      <BroadcastForm cohorts={cohorts} />

      <section>
        <h2 className="mb-3 text-base font-bold text-npb-text">
          Histórico (últimos 20)
        </h2>
        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-8 text-center text-sm text-npb-text-muted">
            Nenhum anúncio enviado ainda.
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((b) => {
              const audience = b.audience as {
                include_cohort_ids?: string[];
                exclude_cohort_ids?: string[];
                roles?: string[];
              };
              const dt = new Date(b.created_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Sao_Paulo",
              });
              return (
                <li
                  key={b.id}
                  className="rounded-xl border border-npb-border bg-npb-bg2 p-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-npb-text">
                      {b.title}
                    </p>
                    <span className="flex-shrink-0 text-[11px] text-npb-text-muted">
                      {dt}
                    </span>
                  </div>
                  {b.body && (
                    <p className="mt-1 line-clamp-2 text-xs text-npb-text-muted">
                      {b.body}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-npb-text-muted">
                    <span>
                      <strong className="text-npb-text">{b.delivered_count}</strong>{" "}
                      entregue{b.delivered_count !== 1 ? "s" : ""} de{" "}
                      {b.recipients_count}
                    </span>
                    {b.failed_count > 0 && (
                      <span className="text-red-400">
                        {b.failed_count} falha{b.failed_count !== 1 ? "s" : ""}
                      </span>
                    )}
                    {audience.include_cohort_ids?.length ? (
                      <span>
                        Incluiu {audience.include_cohort_ids.length} turma
                        {audience.include_cohort_ids.length > 1 ? "s" : ""}
                      </span>
                    ) : null}
                    {audience.exclude_cohort_ids?.length ? (
                      <span>
                        Excluiu {audience.exclude_cohort_ids.length} turma
                        {audience.exclude_cohort_ids.length > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
