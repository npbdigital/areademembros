import Link from "next/link";
import { ArrowLeft, Megaphone } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { BroadcastForm } from "@/components/admin/broadcast-form";
import { StopBroadcastButton } from "@/components/admin/stop-broadcast-button";

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
        "id, title, body, audience, recipients_count, delivered_count, failed_count, created_at, sent_by, deliver_push, deliver_inapp, deliver_banner, banner_expires_at, deliver_popup, popup_expires_at",
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
    deliver_push: boolean;
    deliver_inapp: boolean;
    deliver_banner: boolean;
    banner_expires_at: string | null;
    deliver_popup: boolean;
    popup_expires_at: string | null;
  }>;
  const nowIso = new Date().toISOString();

  // Métricas agregadas por canal — popup tem broadcast_popup_seen
  // (1 row por aluno que viu); banner tem user_dismissed_broadcasts
  // (1 row por aluno que dispensou). Push e in-app já têm contador no
  // proprio broadcast (delivered_count e recipients_count).
  const broadcastIds = history.map((b) => b.id);
  const popupSeenMap = new Map<string, number>();
  const bannerDismissedMap = new Map<string, number>();
  if (broadcastIds.length > 0) {
    const [{ data: seenRows }, { data: dismRows }] = await Promise.all([
      supabase
        .schema("membros")
        .from("broadcast_popup_seen")
        .select("broadcast_id")
        .in("broadcast_id", broadcastIds),
      supabase
        .schema("membros")
        .from("user_dismissed_broadcasts")
        .select("broadcast_id")
        .in("broadcast_id", broadcastIds),
    ]);
    for (const r of (seenRows ?? []) as Array<{ broadcast_id: string }>) {
      popupSeenMap.set(r.broadcast_id, (popupSeenMap.get(r.broadcast_id) ?? 0) + 1);
    }
    for (const r of (dismRows ?? []) as Array<{ broadcast_id: string }>) {
      bannerDismissedMap.set(
        r.broadcast_id,
        (bannerDismissedMap.get(r.broadcast_id) ?? 0) + 1,
      );
    }
  }

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
              const bannerActive =
                b.deliver_banner &&
                (b.banner_expires_at === null || b.banner_expires_at > nowIso);
              const popupActive =
                b.deliver_popup &&
                (b.popup_expires_at === null || b.popup_expires_at > nowIso);
              return (
                <li
                  key={b.id}
                  className="rounded-xl border border-npb-border bg-npb-bg2 p-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-npb-text">
                      {b.title}
                    </p>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className="text-[11px] text-npb-text-muted">
                        {dt}
                      </span>
                      {(bannerActive || popupActive) && (
                        <StopBroadcastButton
                          broadcastId={b.id}
                          title={b.title}
                          channels={{ banner: bannerActive, popup: popupActive }}
                        />
                      )}
                    </div>
                  </div>
                  {b.body && (
                    <p className="mt-1 line-clamp-2 text-xs text-npb-text-muted">
                      {b.body}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-npb-text-muted">
                    <span className="text-npb-text-muted">
                      Audiência:{" "}
                      <strong className="text-npb-text">
                        {b.recipients_count}
                      </strong>
                    </span>
                    {b.deliver_push && (
                      <span title="Notificação no celular/desktop entregue ao OS">
                        📱 Push:{" "}
                        <strong className="text-npb-text">
                          {b.delivered_count}
                        </strong>
                        {b.failed_count > 0 && (
                          <span className="text-red-400">
                            {" "}
                            ({b.failed_count} falha
                            {b.failed_count !== 1 ? "s" : ""})
                          </span>
                        )}
                      </span>
                    )}
                    {b.deliver_inapp && (
                      <span title="Notificação no sino do topbar — criada pra cada aluno da audiência">
                        🔔 In-app: enviado pra todos
                      </span>
                    )}
                    {b.deliver_banner && (
                      <span title="Quantos alunos clicaram em dispensar a barra fixa">
                        📌 Banner:{" "}
                        <strong className="text-npb-text">
                          {bannerDismissedMap.get(b.id) ?? 0}
                        </strong>{" "}
                        dispensaram
                      </span>
                    )}
                    {b.deliver_popup && (
                      <span title="Quantos alunos viram o popup grande (1× por aluno)">
                        🪟 Popup:{" "}
                        <strong className="text-npb-text">
                          {popupSeenMap.get(b.id) ?? 0}
                        </strong>{" "}
                        viram
                      </span>
                    )}
                    {audience.include_cohort_ids?.length ? (
                      <span>
                        · Incluiu {audience.include_cohort_ids.length} turma
                        {audience.include_cohort_ids.length > 1 ? "s" : ""}
                      </span>
                    ) : null}
                    {audience.exclude_cohort_ids?.length ? (
                      <span>
                        · Excluiu {audience.exclude_cohort_ids.length} turma
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
