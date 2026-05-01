import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LessonForm } from "@/components/admin/lesson-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { AttachmentUpload } from "@/components/admin/attachment-upload";
import {
  SortableAttachmentsList,
  type SortableAttachment,
} from "@/components/admin/sortable-attachments-list";
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

  const { data: attachments } = await supabase
    .schema("membros")
    .from("lesson_attachments")
    .select("id, file_name, file_url, file_size_bytes, position")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: true });

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

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Paperclip className="h-5 w-5 text-npb-gold" />
          <h2 className="text-lg font-bold text-npb-text">Anexos</h2>
          <span className="rounded bg-npb-bg3 px-2 py-0.5 text-xs text-npb-text-muted">
            {attachments?.length ?? 0}
          </span>
        </div>
        <p className="mb-3 text-xs text-npb-text-muted">
          PDFs, planilhas, documentos — tudo que ficar disponível pra download
          na aba &quot;Anexos&quot; da aula.
        </p>

        <div className="space-y-3 rounded-2xl border border-npb-border bg-npb-bg2 p-4">
          <AttachmentUpload
            lessonId={lessonId}
            moduleId={moduleId}
            courseId={courseId}
          />

          {attachments && attachments.length > 0 ? (
            <SortableAttachmentsList
              courseId={courseId}
              moduleId={moduleId}
              lessonId={lessonId}
              attachments={attachments as SortableAttachment[]}
            />
          ) : (
            <p className="py-3 text-center text-xs text-npb-text-muted">
              Nenhum anexo nessa aula.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

