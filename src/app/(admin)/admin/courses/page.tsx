import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  SortableCoursesGrid,
  type SortableCourse,
} from "@/components/admin/sortable-courses-grid";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const supabase = createClient();
  const { data: courses } = await supabase
    .schema("membros")
    .from("courses")
    .select("id, title, cover_url, is_published, is_for_sale, position")
    .order("position", { ascending: true })
    .order("title", { ascending: true });

  const list = (courses ?? []) as SortableCourse[];
  const total = list.length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-npb-text">Cursos</h1>
          <p className="text-sm text-npb-text-muted">
            {total === 0
              ? "Nenhum curso ainda."
              : `${total} curso${total > 1 ? "s" : ""} cadastrado${total > 1 ? "s" : ""}.`}
          </p>
        </div>
        <Link
          href="/admin/courses/new"
          className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-3.5 py-2 text-sm font-semibold text-black transition-colors hover:bg-npb-gold-light"
        >
          <Plus className="h-4 w-4" />
          Novo curso
        </Link>
      </div>

      {list.length === 0 ? <EmptyState /> : <SortableCoursesGrid courses={list} />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-npb-border bg-npb-bg2 px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-npb-gold/10 text-npb-gold">
        <BookOpen className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold text-npb-text">
        Nenhum curso por aqui ainda
      </h2>
      <p className="mt-1 max-w-md text-sm text-npb-text-muted">
        Comece criando seu primeiro curso. Depois você adiciona módulos e aulas
        dentro dele.
      </p>
      <Link
        href="/admin/courses/new"
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-npb-gold px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-npb-gold-light"
      >
        <Plus className="h-4 w-4" />
        Criar primeiro curso
      </Link>
    </div>
  );
}
