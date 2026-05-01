import Link from "next/link";
import { ArrowRight, BookOpen, LayoutDashboard, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = createClient();

  const [{ count: coursesCount }, { count: modulesCount }, { count: lessonsCount }] =
    await Promise.all([
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
    ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-npb-gold/10 text-npb-gold">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-npb-text">Painel admin</h1>
          <p className="text-sm text-npb-text-muted">
            Visão geral da plataforma. Métricas de engajamento entram na Etapa
            de relatórios.
          </p>
        </div>
      </div>

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
          icon={Users}
          label="Aulas"
          value={lessonsCount ?? 0}
        />
      </div>

      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <h2 className="text-base font-semibold text-npb-text">
          Por onde começar
        </h2>
        <p className="mt-1 text-sm text-npb-text-muted">
          O CRUD de cursos, módulos e aulas já está funcionando. Crie seu
          primeiro curso e adicione conteúdo.
        </p>
        <Link
          href="/admin/courses"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-3.5 py-2 text-sm font-semibold text-black transition-colors hover:bg-npb-gold-light"
        >
          Ir para cursos
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
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5 text-npb-gold" />
        {href && <ArrowRight className="h-3.5 w-3.5 text-npb-text-muted" />}
      </div>
      <div className="mt-2 text-2xl font-bold text-npb-text">{value}</div>
      <div className="text-xs uppercase tracking-wider text-npb-text-muted">
        {label}
      </div>
    </>
  );
  const className =
    "block rounded-xl border border-npb-border bg-npb-bg2 p-4 transition-colors hover:border-npb-gold-dim";
  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}
