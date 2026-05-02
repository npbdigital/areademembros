import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarDays,
  CalendarRange,
  CircleDot,
  LayoutDashboard,
  Users,
  Wallet,
} from "lucide-react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getNonStudentUserIds } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: { showFicticio?: string };
}) {
  const showFicticio = searchParams?.showFicticio === "1";
  // Conteúdo (cursos/módulos/aulas) — RLS deixa admin ler.
  const supabase = createClient();
  // Métricas que dependem de ler dados de TODOS os alunos — RLS de
  // lesson_progress filtra por auth.uid(), então usamos service_role.
  // Gate de admin é feito no layout /admin.
  const adminSupabase = createAdminClient();

  const now = new Date();
  const since5Min = new Date(now.getTime() - 5 * 60_000).toISOString();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
  ).toISOString();
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString();
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60_000).toISOString();

  // IDs a excluir das contagens de engajamento (admin/mod sempre, ficticio
  // se admin não pediu pra mostrar)
  const excludedIds = await getNonStudentUserIds(adminSupabase, {
    includeFicticio: showFicticio,
  });

  // Filtra rows pelo set de excluídos. Quando excludedIds vazio, retorna todos.
  const excludeFilter = (rows: Array<{ user_id: string }> | null) => {
    if (!rows) return [];
    if (excludedIds.length === 0) return rows;
    const exc = new Set(excludedIds);
    return rows.filter((r) => !exc.has(r.user_id));
  };

  const [
    { count: coursesCount },
    { count: modulesCount },
    { count: lessonsCount },
    studentsRes,
    { data: liveRows },
    { data: todayRows },
    { data: last7dRows },
    { data: last30dRows },
    { data: salesRows },
  ] = await Promise.all([
    supabase
      .schema("membros")
      .from("courses")
      .select("id", { count: "exact", head: true }),
    supabase
      .schema("membros")
      .from("modules")
      .select("id", { count: "exact", head: true }),
    supabase
      .schema("membros")
      .from("lessons")
      .select("id", { count: "exact", head: true }),
    adminSupabase
      .schema("membros")
      .from("users")
      .select("id", { count: "exact", head: true })
      .in("role", showFicticio ? ["student", "ficticio"] : ["student"]),
    adminSupabase
      .schema("membros")
      .from("lesson_progress")
      .select("user_id")
      .gte("last_watched_at", since5Min),
    adminSupabase
      .schema("membros")
      .from("lesson_progress")
      .select("user_id")
      .gte("last_watched_at", startOfDay),
    adminSupabase
      .schema("membros")
      .from("lesson_progress")
      .select("user_id")
      .gte("last_watched_at", since7d),
    adminSupabase
      .schema("membros")
      .from("lesson_progress")
      .select("user_id")
      .gte("last_watched_at", since30d),
    // Vendas afiliados — só pagas. Janela de 12 meses pra incluir o gráfico.
    (() => {
      const since12m = new Date(now);
      since12m.setMonth(since12m.getMonth() - 12);
      since12m.setDate(1);
      since12m.setHours(0, 0, 0, 0);
      return adminSupabase
        .schema("afiliados")
        .from("sales")
        .select("approved_at, commission_value_cents, status, member_user_id")
        .eq("status", "paid")
        .gte("approved_at", since12m.toISOString());
    })(),
  ]);

  const studentsCount = studentsRes.count ?? 0;

  const distinctCount = (rows: Array<{ user_id: string }>): number =>
    new Set(rows.map((r) => r.user_id)).size;

  const liveNow = distinctCount(
    excludeFilter(liveRows as Array<{ user_id: string }> | null),
  );
  const today = distinctCount(
    excludeFilter(todayRows as Array<{ user_id: string }> | null),
  );
  const last7d = distinctCount(
    excludeFilter(last7dRows as Array<{ user_id: string }> | null),
  );
  const last30d = distinctCount(
    excludeFilter(last30dRows as Array<{ user_id: string }> | null),
  );

  // Stats de vendas afiliados — total inclui órfãs (sem differenciar). Aqui
  // queremos volume bruto.
  const sales = (salesRows ?? []) as Array<{
    approved_at: string | null;
    commission_value_cents: number;
    status: string;
    member_user_id: string | null;
  }>;
  const inWindow = (iso: string | null, fromIso: string) =>
    iso !== null && iso >= fromIso;
  const salesToday = sales.filter((s) => inWindow(s.approved_at, startOfDay));
  const sales7d = sales.filter((s) => inWindow(s.approved_at, since7d));
  const sales30d = sales.filter((s) => inWindow(s.approved_at, since30d));
  const sumCents = (arr: typeof sales) =>
    arr.reduce((acc, s) => acc + (s.commission_value_cents ?? 0), 0);
  const formatBRL = (cents: number) =>
    `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Buckets por mês (últimos 12) pra gráfico
  const monthBuckets: Array<{ key: string; label: string; cents: number; count: number }> =
    [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setMonth(next.getMonth() + 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      month: "short",
    });
    const inThisMonth = sales.filter(
      (s) =>
        s.approved_at !== null &&
        s.approved_at >= d.toISOString() &&
        s.approved_at < next.toISOString(),
    );
    monthBuckets.push({
      key,
      label,
      cents: sumCents(inThisMonth),
      count: inThisMonth.length,
    });
  }
  const maxCents = Math.max(1, ...monthBuckets.map((b) => b.cents));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-npb-gold/10 text-npb-gold">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-npb-text">Painel admin</h1>
          <p className="text-sm text-npb-text-muted">
            Visão geral da plataforma — conteúdo e engajamento dos alunos
            {showFicticio ? " (fictícios incluídos)" : " (fictícios escondidos)"}.
          </p>
        </div>
        <Link
          href={
            showFicticio
              ? "/admin/dashboard"
              : "/admin/dashboard?showFicticio=1"
          }
          className="text-xs text-npb-text-muted hover:text-npb-gold"
        >
          {showFicticio ? "Esconder fictícios" : "Mostrar fictícios"}
        </Link>
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-npb-text-muted">
          Alunos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            icon={Users}
            label="Cadastrados"
            value={studentsCount}
            href="/admin/students"
            tone="default"
          />
          <StatCard
            icon={CircleDot}
            label="Ao vivo agora"
            value={liveNow}
            hint="últimos 5min"
            tone={liveNow > 0 ? "live" : "default"}
          />
          <StatCard
            icon={Calendar}
            label="Hoje"
            value={today}
            hint="acessaram"
          />
          <StatCard
            icon={CalendarDays}
            label="7 dias"
            value={last7d}
            hint="acessaram"
          />
          <StatCard
            icon={CalendarRange}
            label="30 dias"
            value={last30d}
            hint="acessaram"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-npb-text-muted">
          Conteúdo
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={BookOpen}
            label="Cursos"
            value={coursesCount ?? 0}
            href="/admin/courses"
          />
          <StatCard
            icon={LayoutDashboard}
            label="Módulos"
            value={modulesCount ?? 0}
          />
          <StatCard
            icon={Activity}
            label="Aulas"
            value={lessonsCount ?? 0}
          />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-npb-text-muted">
            Vendas afiliados
          </h2>
          <Link
            href="/admin/affiliates"
            className="text-[10px] text-npb-text-muted hover:text-npb-gold"
          >
            ver detalhes →
          </Link>
        </div>
        <p className="mb-3 text-[10px] text-npb-text-muted">
          Conta TODAS as vendas pagas (atribuídas + órfãs).
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={Wallet}
            label="Hoje"
            value={salesToday.length}
            hint={formatBRL(sumCents(salesToday))}
          />
          <StatCard
            icon={CalendarDays}
            label="7 dias"
            value={sales7d.length}
            hint={formatBRL(sumCents(sales7d))}
          />
          <StatCard
            icon={CalendarRange}
            label="30 dias"
            value={sales30d.length}
            hint={formatBRL(sumCents(sales30d))}
          />
        </div>

        {/* Gráfico mensal */}
        <div className="mt-3 rounded-xl border border-npb-border bg-npb-bg2 p-4">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-npb-text-muted">
                Comissão por mês
              </p>
              <p className="text-[10px] text-npb-text-muted">
                Últimos 12 meses · só vendas pagas
              </p>
            </div>
            <p className="text-xs text-npb-gold">
              total: {formatBRL(monthBuckets.reduce((a, b) => a + b.cents, 0))}
            </p>
          </div>
          <div className="flex items-end gap-1.5" style={{ height: "140px" }}>
            {monthBuckets.map((b) => {
              const heightPct = b.cents > 0 ? (b.cents / maxCents) * 100 : 2;
              return (
                <div
                  key={b.key}
                  className="group flex flex-1 flex-col items-center gap-1"
                >
                  <div className="relative flex h-full w-full items-end">
                    <div
                      className={`w-full rounded-t transition ${
                        b.cents > 0
                          ? "bg-npb-gold/70 group-hover:bg-npb-gold"
                          : "bg-npb-bg3"
                      }`}
                      style={{ height: `${heightPct}%` }}
                      title={`${b.label}: ${formatBRL(b.cents)} (${b.count} vendas)`}
                    />
                    <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-npb-bg3 px-2 py-1 text-[10px] text-npb-text shadow-lg group-hover:block">
                      {formatBRL(b.cents)} · {b.count}
                    </div>
                  </div>
                  <span className="text-[9px] text-npb-text-muted">
                    {b.label.replace(".", "")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <h2 className="text-base font-semibold text-npb-text">
          Quer ver detalhes?
        </h2>
        <p className="mt-1 text-sm text-npb-text-muted">
          A tela de relatórios mostra engajamento por curso, top aulas e
          comentários recentes.
        </p>
        <Link
          href="/admin/reports"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-3.5 py-2 text-sm font-semibold text-black transition-colors hover:bg-npb-gold-light"
        >
          Abrir relatórios
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
  hint,
  tone = "default",
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
  href?: string;
  hint?: string;
  tone?: "default" | "live";
}) {
  const accent =
    tone === "live"
      ? "border-green-500/40 bg-green-500/5"
      : "border-npb-border bg-npb-bg2 hover:border-npb-gold-dim";
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <Icon
          className={
            tone === "live"
              ? "h-5 w-5 text-green-400"
              : "h-5 w-5 text-npb-gold"
          }
        />
        {href && <ArrowRight className="h-3.5 w-3.5 text-npb-text-muted" />}
      </div>
      <div className="mt-2 text-2xl font-bold text-npb-text">{value}</div>
      <div className="text-xs uppercase tracking-wider text-npb-text-muted">
        {label}
      </div>
      {hint && (
        <div className="mt-0.5 text-[10px] text-npb-text-muted">{hint}</div>
      )}
    </>
  );
  const className = `block rounded-xl border p-4 transition-colors ${accent}`;
  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}
