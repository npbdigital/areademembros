import Link from "next/link";
import { BookOpen, Eye, EyeOff, Plus, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReorderControls } from "@/components/admin/reorder-controls";
import { moveCourseAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const supabase = createClient();
  const { data: courses } = await supabase
    .schema("membros")
    .from("courses")
    .select("id, title, cover_url, is_published, is_for_sale, position")
    .order("position", { ascending: true })
    .order("title", { ascending: true });

  const list = courses ?? [];
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

      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((course, index) => (
            <CourseCard
              key={course.id}
              course={course}
              isFirst={index === 0}
              isLast={index === list.length - 1}
            />
          ))}
        </div>
      )}
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
        Comece criando seu primeiro curso. Depois você adiciona módulos e
        aulas dentro dele.
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

interface CourseRow {
  id: string;
  title: string;
  cover_url: string | null;
  is_published: boolean | null;
  is_for_sale: boolean | null;
  position: number | null;
}

function CourseCard({
  course,
  isFirst,
  isLast,
}: {
  course: CourseRow;
  isFirst: boolean;
  isLast: boolean;
}) {
  const moveUp = moveCourseAction.bind(null, course.id, "up");
  const moveDown = moveCourseAction.bind(null, course.id, "down");

  return (
    <Link
      href={`/admin/courses/${course.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-npb-border bg-npb-bg2 transition-all hover:border-npb-gold-dim hover:shadow-npb-card-hover"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-npb-bg3">
        {course.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.cover_url}
            alt={course.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-npb-text-muted">
            <BookOpen className="h-12 w-12 opacity-30" />
          </div>
        )}
        <div className="absolute right-2 top-2" onClick={(e) => e.preventDefault()}>
          <ReorderControls
            onMove={async (dir) => (dir === "up" ? moveUp() : moveDown())}
            disableUp={isFirst}
            disableDown={isLast}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-npb-text group-hover:text-npb-gold">
          {course.title}
        </h3>
        <div className="mt-auto flex flex-wrap gap-1.5">
          <StatusPill
            active={Boolean(course.is_published)}
            iconActive={Eye}
            iconInactive={EyeOff}
            labelActive="Publicado"
            labelInactive="Rascunho"
          />
          {course.is_for_sale && (
            <span className="inline-flex items-center gap-1 rounded bg-npb-gold/15 px-2 py-0.5 text-[10px] font-semibold text-npb-gold">
              <Tag className="h-3 w-3" />À venda
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function StatusPill({
  active,
  iconActive: IconActive,
  iconInactive: IconInactive,
  labelActive,
  labelInactive,
}: {
  active: boolean;
  iconActive: typeof Eye;
  iconInactive: typeof Eye;
  labelActive: string;
  labelInactive: string;
}) {
  const Icon = active ? IconActive : IconInactive;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
        active
          ? "bg-green-500/15 text-green-400"
          : "bg-npb-bg3 text-npb-text-muted"
      }`}
    >
      <Icon className="h-3 w-3" />
      {active ? labelActive : labelInactive}
    </span>
  );
}
