import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LessonForm } from "@/components/admin/lesson-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteLessonAction, updateLessonAction } from "../../../../../actions";

export const dynamic = "force-dynamic";

export default async function EditLessonPage({
  params,
}: {
  params: { id: string; moduleId: string; lessonId: string };
}) {
  const { id: courseId, moduleId, lessonId } = params;
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
    .select("id, title, course_id")
    .eq("id", moduleId)
    .single();

  const { data: lesson } = await supabase
    .schema("membros")
    .from("lessons")
    .select(
      "id, title, description_html, youtube_video_id, duration_seconds, release_type, release_days, release_date, module_id",
    )
    .eq("id", lessonId)
    .single();

  if (
    !course ||
    !mod ||
    !lesson ||
    mod.course_id !== courseId ||
    lesson.module_id !== moduleId
  ) {
    notFound();
  }

  const updateAction = updateLessonAction.bind(null, lessonId, moduleId, courseId);
  const deleteAction = deleteLessonAction.bind(null, lessonId, moduleId, courseId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-npb-text-muted">
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
          <Link
            href={`/admin/courses/${courseId}/modules/${moduleId}`}
            className="hover:text-npb-text"
          >
            {mod.title}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-npb-text">{lesson.title}</span>
        </div>
        <DeleteButton
          action={deleteAction}
          confirmMessage={`Excluir a aula "${lesson.title}"?`}
          label="Excluir aula"
        />
      </div>

      <div>
        <Link
          href={`/admin/courses/${courseId}/modules/${moduleId}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-npb-text-muted hover:text-npb-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para o módulo
        </Link>
        <h1 className="mb-1 text-xl font-bold text-npb-text">{lesson.title}</h1>
        <p className="mb-6 text-sm text-npb-text-muted">
          Configure vídeo, descrição e regra de liberação da aula.
        </p>
      </div>

      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <LessonForm
          action={updateAction}
          initialValues={lesson}
          submitLabel="Salvar alterações"
          successMessage="Aula atualizada."
        />
      </div>
    </div>
  );
}
