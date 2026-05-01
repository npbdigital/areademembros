import Link from "next/link";
import {
  ChevronRight,
  Clock,
  Infinity as InfinityIcon,
  Layers,
  Plus,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/format-duration";

export const dynamic = "force-dynamic";

export default async function AdminCohortsPage() {
  const supabase = createClient();

  const { data: cohorts } = await supabase
    .schema("membros")
    .from("cohorts")
    .select("id, name, description, default_duration_days, created_at")
    .order("created_at", { ascending: false });

  const list = cohorts ?? [];

  // Conta cursos vinculados e alunos matriculados por turma
  const ids = list.map((c) => c.id);
  const courseCounts: Record<string, number> = {};
  const studentCounts: Record<string, number> = {};

  if (ids.length > 0) {
    const { data: cc } = await supabase
      .schema("membros")
      .from("cohort_courses")
      .select("cohort_id")
      .in("cohort_id", ids);
    for (const row of cc ?? []) {
      courseCounts[row.cohort_id] = (courseCounts[row.cohort_id] ?? 0) + 1;
    }

    const { data: en } = await supabase
      .schema("membros")
      .from("enrollments")
      .select("cohort_id")
      .in("cohort_id", ids)
      .eq("is_active", true);
    for (const row of en ?? []) {
      studentCounts[row.cohort_id] = (studentCounts[row.cohort_id] ?? 0) + 1;
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-npb-text">Turmas</h1>
          <p className="text-sm text-npb-text-muted">
            {list.length === 0
              ? "Nenhuma turma ainda."
              : `${list.length} turma${list.length > 1 ? "s" : ""}.`}
          </p>
        </div>
        <Link
          href="/admin/cohorts/new"
          className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-3.5 py-2 text-sm font-semibold text-black transition-colors hover:bg-npb-gold-light"
        >
          <Plus className="h-4 w-4" />
          Nova turma
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-npb-border bg-npb-bg2 px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-npb-gold/10 text-npb-gold">
            <Layers className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-npb-text">
            Nenhuma turma cadastrada
          </h2>
          <p className="mt-1 max-w-md text-sm text-npb-text-muted">
            Turma é o que dá acesso a um conjunto de cursos. Cada aluno
            matriculado em uma turma vê os cursos que ela libera.
          </p>
          <Link
            href="/admin/cohorts/new"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-npb-gold px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-npb-gold-light"
          >
            <Plus className="h-4 w-4" />
            Criar primeira turma
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((cohort) => (
            <li key={cohort.id}>
              <Link
                href={`/admin/cohorts/${cohort.id}`}
                className="group flex flex-col gap-3 rounded-xl border border-npb-border bg-npb-bg2 p-4 transition-colors hover:border-npb-gold-dim"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-npb-gold/10 text-npb-gold">
                    <Layers className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-npb-text-muted group-hover:text-npb-gold" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-npb-text group-hover:text-npb-gold">
                    {cohort.name}
                  </h3>
                  {cohort.description && (
                    <p className="line-clamp-2 mt-0.5 text-xs text-npb-text-muted">
                      {cohort.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-npb-text-muted">
                  <span>
                    📚 {courseCounts[cohort.id] ?? 0} curso
                    {(courseCounts[cohort.id] ?? 0) !== 1 ? "s" : ""}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {studentCounts[cohort.id] ?? 0} aluno
                    {(studentCounts[cohort.id] ?? 0) !== 1 ? "s" : ""}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-npb-bg3 px-1.5 py-0.5 text-[10px] font-medium text-npb-gold">
                    {cohort.default_duration_days == null ? (
                      <InfinityIcon className="h-2.5 w-2.5" />
                    ) : (
                      <Clock className="h-2.5 w-2.5" />
                    )}
                    {formatDuration(cohort.default_duration_days)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
