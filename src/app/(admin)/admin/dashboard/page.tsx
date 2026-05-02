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
} from "lucide-react";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
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

  const [
    { count: coursesCount },
    { count: modulesCount },
    { count: lessonsCount },
    { count: studentsCount },
    { data: liveRows },
    { data: todayRows },
    { data: last7dRows },
    { data: last30dRows },
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
      .eq("role", "student"),
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
  ]);

  const distinctCount = (
    rows: Array<{ user_id: string }> | null,
  ): number => new Set((rows ?? []).map((r) => r.user_id)).size;

  const liveNow = distinctCount(liveRows as Array<{ user_id: string }> | null);
  const today = distinctCount(todayRows as Array<{ user_id: string }> | null);
  const last7d = distinctCount(last7dRows as Array<{ user_id: string }> | null);
  const last30d = distinctCount(
    last30dRows as Array<{ user_id: string }> | null,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-npb-gold/10 text-npb-gold">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-npb-text">Painel admin</h1>
          <p className="text-sm text-npb-text-muted">
            Visão geral da plataforma — conteúdo e engajamento dos alunos.
          </p>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-npb-text-muted">
          Alunos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            icon={Users}
            label="Cadastrados"
            value={studentsCount ?? 0}
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
