import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Layers,
  Lock,
  PlayCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CourseForm } from "@/components/admin/course-form";
import { AddChildForm } from "@/components/admin/add-child-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { ReorderControls } from "@/components/admin/reorder-controls";
import {
  createModuleAction,
  deleteCourseAction,
  deleteModuleAction,
  moveModuleAction,
  updateCourseAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const courseId = params.id;

  const { data: course } = await supabase
    .schema("membros")
    .from("courses")
    .select(
      "id, title, description, cover_url, is_published, is_for_sale, sale_url",
    )
    .eq("id", courseId)
    .single();

  if (!course) notFound();

  const { data: modules } = await supabase
    .schema("membros")
    .from("modules")
    .select("id, title, position, release_type, cover_url")
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  // Conta aulas por módulo
  const moduleIds = (modules ?? []).map((m) => m.id);
  const lessonCounts: Record<string, number> = {};
  if (moduleIds.length > 0) {
    const { data: lessons } = await supabase
      .schema("membros")
      .from("lessons")
      .select("module_id")
      .in("module_id", moduleIds);
    for (const l of lessons ?? []) {
      lessonCounts[l.module_id] = (lessonCounts[l.module_id] ?? 0) + 1;
    }
  }

  const updateAction = updateCourseAction.bind(null, courseId);
  const deleteAction = deleteCourseAction.bind(null, courseId);
  const createModule = createModuleAction.bind(null, courseId);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/courses"
          className="inline-flex items-center gap-1.5 text-sm text-npb-text-muted hover:text-npb-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para a lista
        </Link>
        <DeleteButton
          action={deleteAction}
          confirmMessage={`Excluir o curso "${course.title}"? Todos os módulos e aulas dentro dele também serão removidos. Não dá pra desfazer.`}
          label="Excluir curso"
        />
      </div>

      {/* Detalhes do curso */}
      <section>
        <h1 className="mb-1 text-xl font-bold text-npb-text">
          {course.title}
        </h1>
        <p className="mb-6 text-sm text-npb-text-muted">
          Edite os detalhes principais. Módulos e aulas ficam logo abaixo.
        </p>
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
          <CourseForm
            action={updateAction}
            initialValues={course}
            submitLabel="Salvar alterações"
            successMessage="Curso atualizado."
          />
        </div>
      </section>

      {/* Módulos */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Layers className="h-5 w-5 text-npb-gold" />
          <h2 className="text-lg font-bold text-npb-text">Módulos</h2>
          <span className="rounded bg-npb-bg3 px-2 py-0.5 text-xs text-npb-text-muted">
            {modules?.length ?? 0}
          </span>
        </div>

        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-4">
          <div className="mb-4">
            <AddChildForm
              action={createModule}
              placeholder="Título do novo módulo"
              buttonLabel="Adicionar módulo"
            />
          </div>

          {modules && modules.length > 0 ? (
            <ul className="divide-y divide-npb-border">
              {modules.map((m, index) => (
                <ModuleRow
                  key={m.id}
                  module={m}
                  courseId={courseId}
                  lessonCount={lessonCounts[m.id] ?? 0}
                  isFirst={index === 0}
                  isLast={index === modules.length - 1}
                />
              ))}
            </ul>
          ) : (
            <p className="px-2 py-6 text-center text-sm text-npb-text-muted">
              Nenhum módulo ainda. Adicione o primeiro acima.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

interface ModuleRowProps {
  module: {
    id: string;
    title: string;
    position: number | null;
    release_type: string | null;
    cover_url: string | null;
  };
  courseId: string;
  lessonCount: number;
  isFirst: boolean;
  isLast: boolean;
}

function ModuleRow({
  module: m,
  courseId,
  lessonCount,
  isFirst,
  isLast,
}: ModuleRowProps) {
  const moveAction = moveModuleAction.bind(null, m.id, courseId);
  const deleteAction = deleteModuleAction.bind(null, m.id, courseId);
  const isLocked = m.release_type === "locked";

  return (
    <li className="flex items-center gap-3 px-2 py-3">
      <ReorderControls
        onMove={(dir) => moveAction(dir)}
        disableUp={isFirst}
        disableDown={isLast}
      />

      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-npb-bg3">
        {m.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.cover_url}
            alt={m.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-npb-text-muted">
            <Layers className="h-4 w-4" />
          </div>
        )}
      </div>

      <Link
        href={`/admin/courses/${courseId}/modules/${m.id}`}
        className="flex flex-1 items-center justify-between gap-3 group"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-npb-text group-hover:text-npb-gold">
              {m.title}
            </span>
            {isLocked && (
              <span className="inline-flex items-center gap-0.5 rounded bg-npb-bg3 px-1.5 py-0.5 text-[10px] font-medium text-npb-text-muted">
                <Lock className="h-2.5 w-2.5" />
                bloqueado
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-npb-text-muted">
            <PlayCircle className="h-3 w-3" />
            {lessonCount === 0
              ? "Nenhuma aula"
              : `${lessonCount} aula${lessonCount > 1 ? "s" : ""}`}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-npb-text-muted group-hover:text-npb-gold" />
      </Link>

      <DeleteButton
        action={deleteAction}
        confirmMessage={`Excluir o módulo "${m.title}"? As aulas dentro dele também serão removidas.`}
        variant="icon"
        label="Excluir módulo"
      />
    </li>
  );
}
