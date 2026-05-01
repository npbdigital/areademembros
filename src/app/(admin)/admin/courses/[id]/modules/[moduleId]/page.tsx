import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ModuleForm } from "@/components/admin/module-form";
import { AddChildForm } from "@/components/admin/add-child-form";
import { DeleteButton } from "@/components/admin/delete-button";
import {
  SortableLessonsList,
  type SortableLesson,
} from "@/components/admin/sortable-lessons-list";
import {
  createLessonAction,
  deleteModuleAction,
  updateModuleAction,
} from "../../../actions";

export const dynamic = "force-dynamic";

export default async function EditModulePage({
  params,
}: {
  params: { id: string; moduleId: string };
}) {
  const { id: courseId, moduleId } = params;
  const supabase = createClient();

  const { data: course } = await supabase
    .schema("membros")
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .single();

  const { data: mod } = await supabase
    .schema("membros")
    .from("modules")
    .select(
      "id, title, description, cover_url, release_type, release_days, release_date, course_id",
    )
    .eq("id", moduleId)
    .single();

  if (!course || !mod || mod.course_id !== courseId) notFound();

  const { data: lessons } = await supabase
    .schema("membros")
    .from("lessons")
    .select(
      "id, title, position, release_type, youtube_video_id, duration_seconds",
    )
    .eq("module_id", moduleId)
    .order("position", { ascending: true });

  const updateAction = updateModuleAction.bind(null, moduleId, courseId);
  const deleteAction = deleteModuleAction.bind(null, moduleId, courseId);
  const createLesson = createLessonAction.bind(null, moduleId, courseId);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-npb-text-muted">
          <Link href="/admin/courses" className="hover:text-npb-text">
            Cursos
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link
            href={`/admin/courses/${courseId}`}
            className="hover:text-npb-text"
          >
            {course.title}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-npb-text">{mod.title}</span>
        </div>
        <DeleteButton
          action={deleteAction}
          confirmMessage={`Excluir o módulo "${mod.title}"? As aulas dentro dele também serão removidas.`}
          label="Excluir módulo"
        />
      </div>

      {/* Detalhes do módulo */}
      <section>
        <Link
          href={`/admin/courses/${courseId}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-npb-text-muted hover:text-npb-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para o curso
        </Link>
        <h1 className="mb-1 text-xl font-bold text-npb-text">{mod.title}</h1>
        <p className="mb-6 text-sm text-npb-text-muted">
          Edite título, descrição, capa e regra de liberação do módulo.
        </p>
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
          <ModuleForm
            action={updateAction}
            initialValues={mod}
            submitLabel="Salvar alterações"
            successMessage="Módulo atualizado."
          />
        </div>
      </section>

      {/* Aulas */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <PlayCircle className="h-5 w-5 text-npb-gold" />
          <h2 className="text-lg font-bold text-npb-text">Aulas</h2>
          <span className="rounded bg-npb-bg3 px-2 py-0.5 text-xs text-npb-text-muted">
            {lessons?.length ?? 0}
          </span>
        </div>

        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-4">
          <div className="mb-4">
            <AddChildForm
              action={createLesson}
              placeholder="Título da nova aula"
              buttonLabel="Adicionar aula"
            />
          </div>

          {lessons && lessons.length > 0 ? (
            <SortableLessonsList
              courseId={courseId}
              moduleId={moduleId}
              lessons={lessons as SortableLesson[]}
            />
          ) : (
            <p className="px-2 py-6 text-center text-sm text-npb-text-muted">
              Nenhuma aula ainda. Adicione a primeira acima.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
