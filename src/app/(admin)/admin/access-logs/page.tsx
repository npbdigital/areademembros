import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ScrollText,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDateTimeBrt } from "@/lib/format-date";
import { AccessLogActions } from "@/components/admin/access-log-actions";

export const dynamic = "force-dynamic";

interface PurchaseEventRow {
  id: string;
  platform: string;
  event: string;
  email: string;
  full_name: string | null;
  product_name: string | null;
  payment_total_value: number | null;
  status: string;
  matched_cohort_id: string | null;
  user_id: string | null;
  enrollment_id: string | null;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "unmapped", label: "Aprovadas sem cadastro" },
  { key: "failed", label: "Com erro" },
  { key: "pending", label: "Aguardando" },
  { key: "processed", label: "Processadas" },
];

export default async function AccessLogsPage({
  searchParams,
}: {
  searchParams?: { status?: string; q?: string };
}) {
  const status = searchParams?.status ?? "all";
  const q = (searchParams?.q ?? "").trim();

  const sb = createAdminClient();

  let query = sb
    .schema("membros")
    .from("purchase_events")
    .select(
      "id, platform, event, email, full_name, product_name, payment_total_value, status, matched_cohort_id, user_id, enrollment_id, error_message, created_at, processed_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (q) {
    query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  }

  const [
    { data: rows },
    { data: cohortsData },
    { count: unmappedCount },
    { count: failedCount },
    { count: pendingCount },
    { count: processedCount },
  ] = await Promise.all([
    query,
    sb
      .schema("membros")
      .from("cohorts")
      .select("id, name, default_duration_days")
      .order("name"),
    sb
      .schema("membros")
      .from("purchase_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "unmapped"),
    sb
      .schema("membros")
      .from("purchase_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    sb
      .schema("membros")
      .from("purchase_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    sb
      .schema("membros")
      .from("purchase_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "processed"),
  ]);

  const events = (rows ?? []) as PurchaseEventRow[];
  const cohorts = (cohortsData ?? []) as Array<{
    id: string;
    name: string;
    default_duration_days: number | null;
  }>;
  const cohortById = new Map(cohorts.map((c) => [c.id, c]));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center gap-1 text-sm text-npb-text-muted hover:text-npb-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <header>
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
          <ScrollText className="h-3.5 w-3.5" />
          Logs de acesso
        </div>
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          Eventos de compra
        </h1>
        <p className="mt-2 text-sm text-npb-text-muted">
          Timeline de tudo que aconteceu com as vendas dos seus produtos
          (Kiwify, Hubla, Payt, Youshop). Aqui você vê o que virou matrícula,
          o que ficou pendente, e o que precisa de aprovação manual.
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Aprovadas sem cadastro"
          value={unmappedCount ?? 0}
          tone="warning"
          icon={<TriangleAlert className="h-4 w-4" />}
          href="?status=unmapped"
        />
        <KpiCard
          label="Com erro"
          value={failedCount ?? 0}
          tone="danger"
          icon={<XCircle className="h-4 w-4" />}
          href="?status=failed"
        />
        <KpiCard
          label="Aguardando"
          value={pendingCount ?? 0}
          tone="muted"
          icon={<Clock className="h-4 w-4" />}
          href="?status=pending"
        />
        <KpiCard
          label="Processadas"
          value={processedCount ?? 0}
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4" />}
          href="?status=processed"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-npb-text-muted">
          Filtrar:
        </span>
        {STATUS_FILTERS.map((f) => {
          const isActive = (status ?? "all") === f.key;
          const params = new URLSearchParams();
          if (f.key !== "all") params.set("status", f.key);
          if (q) params.set("q", q);
          return (
            <Link
              key={f.key}
              href={`?${params.toString()}`}
              className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
                isActive
                  ? "border-npb-gold bg-npb-gold/10 text-npb-gold"
                  : "border-npb-border bg-npb-bg3 text-npb-text-muted hover:border-npb-gold-dim hover:text-npb-text"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Busca */}
      <form className="flex gap-2" action="" method="get">
        {status !== "all" && (
          <input type="hidden" name="status" defaultValue={status} />
        )}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por e-mail ou nome…"
          className="flex-1 rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
        />
        <button
          type="submit"
          className="rounded-md bg-npb-gold px-4 py-2 text-sm font-semibold text-black hover:bg-npb-gold-light"
        >
          Buscar
        </button>
      </form>

      {/* Lista de eventos */}
      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/40 p-10 text-center">
          <ScrollText className="mx-auto h-10 w-10 text-npb-text-muted opacity-40" />
          <p className="mt-3 text-sm text-npb-text-muted">
            Nenhum evento encontrado com esses filtros.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <EventRow
              key={ev.id}
              event={ev}
              cohortName={
                ev.matched_cohort_id
                  ? cohortById.get(ev.matched_cohort_id)?.name
                  : null
              }
              cohorts={cohorts}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
  icon,
  href,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "muted";
  icon: React.ReactNode;
  href: string;
}) {
  const colors: Record<typeof tone, string> = {
    success: "border-emerald-500/40 bg-emerald-500/5 text-emerald-400",
    warning: "border-yellow-500/40 bg-yellow-500/5 text-yellow-400",
    danger: "border-red-500/40 bg-red-500/5 text-red-400",
    muted: "border-npb-border bg-npb-bg2 text-npb-text-muted",
  };
  return (
    <Link
      href={href}
      className={`rounded-xl border p-3 transition hover:scale-[1.02] ${colors[tone]}`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-npb-text">{value}</div>
    </Link>
  );
}

function EventRow({
  event,
  cohortName,
  cohorts,
}: {
  event: PurchaseEventRow;
  cohortName: string | null | undefined;
  cohorts: Array<{
    id: string;
    name: string;
    default_duration_days: number | null;
  }>;
}) {
  const isApproved = event.event === "Compra Aprovada";
  const isRefund =
    event.event === "Compra Reembolsada" ||
    event.event === "Compra Cancelada";

  const statusBadge =
    event.status === "processed"
      ? {
          label: isApproved ? "✓ Cadastrado" : "✓ Acesso removido",
          color: "bg-emerald-500/15 text-emerald-400",
        }
      : event.status === "unmapped"
        ? {
            label: "⚠ Aguardando mapeamento",
            color: "bg-yellow-500/15 text-yellow-400",
          }
        : event.status === "failed"
          ? {
              label: "✗ Erro",
              color: "bg-red-500/15 text-red-400",
            }
          : event.status === "skipped"
            ? {
                label: "— Ignorado",
                color: "bg-npb-bg3 text-npb-text-muted",
              }
            : {
                label: "⋯ Aguardando",
                color: "bg-npb-bg3 text-npb-text-muted",
              };

  const eventBadge = isApproved
    ? { label: "Compra Aprovada", color: "bg-emerald-500/10 text-emerald-300" }
    : isRefund
      ? {
          label: event.event,
          color: "bg-red-500/10 text-red-300",
        }
      : { label: event.event, color: "bg-npb-bg3 text-npb-text-muted" };

  return (
    <li
      className={`rounded-xl border p-4 ${
        event.status === "unmapped"
          ? "border-yellow-500/30 bg-yellow-500/5"
          : event.status === "failed"
            ? "border-red-500/30 bg-red-500/5"
            : "border-npb-border bg-npb-bg2"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusBadge.color}`}
            >
              {statusBadge.label}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${eventBadge.color}`}
            >
              {eventBadge.label}
            </span>
            <span className="rounded bg-npb-bg3 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-npb-text-muted">
              {event.platform}
            </span>
          </div>

          <h3 className="mt-1.5 text-sm font-bold text-npb-text">
            {event.full_name || event.email}{" "}
            <span className="font-normal text-npb-text-muted">
              · {event.email}
            </span>
          </h3>

          <p className="mt-1 text-xs text-npb-text-muted">
            <strong className="text-npb-text">{event.product_name}</strong>
            {event.payment_total_value ? (
              <>
                <span className="px-2">·</span>
                R${" "}
                {Number(event.payment_total_value).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </>
            ) : null}
            {cohortName && (
              <>
                <span className="px-2">·</span>
                <span className="rounded bg-npb-gold/10 px-1.5 py-0.5 text-[10px] text-npb-gold">
                  → {cohortName}
                </span>
              </>
            )}
          </p>

          <p className="mt-1 text-[11px] text-npb-text-muted">
            {formatDateTimeBrt(event.created_at)}
            {event.processed_at && (
              <>
                <span className="px-2">·</span>
                Processado em {formatDateTimeBrt(event.processed_at)}
              </>
            )}
          </p>

          {event.error_message && (
            <p className="mt-2 rounded border border-red-500/30 bg-red-500/5 p-2 text-[11px] text-red-300">
              {event.error_message}
            </p>
          )}
        </div>

        <AccessLogActions
          eventId={event.id}
          status={event.status}
          isApproved={isApproved}
          cohorts={cohorts}
        />
      </div>
    </li>
  );
}
