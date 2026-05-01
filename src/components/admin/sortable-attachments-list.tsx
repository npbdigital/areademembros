"use client";

import { useTransition } from "react";
import { FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SortableList } from "@/components/admin/sortable-list";
import { deleteLessonAttachmentAction } from "@/app/(admin)/admin/courses/actions";

export interface SortableAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size_bytes: number | null;
  position: number | null;
}

interface Props {
  courseId: string;
  moduleId: string;
  lessonId: string;
  attachments: SortableAttachment[];
}

export function SortableAttachmentsList({
  courseId,
  moduleId,
  lessonId,
  attachments,
}: Props) {
  return (
    <SortableList
      table="lesson_attachments"
      items={attachments}
      revalidatePaths={[
        `/admin/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
        `/lessons/${lessonId}`,
      ]}
      className="space-y-2"
      renderItem={(a) => (
        <AttachmentRowContent
          attachment={a}
          courseId={courseId}
          moduleId={moduleId}
          lessonId={lessonId}
        />
      )}
    />
  );
}

function AttachmentRowContent({
  attachment: a,
  courseId,
  moduleId,
  lessonId,
}: {
  attachment: SortableAttachment;
  courseId: string;
  moduleId: string;
  lessonId: string;
}) {
  const [pending, startTransition] = useTransition();

  const sizeLabel = a.file_size_bytes
    ? a.file_size_bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(a.file_size_bytes / 1024))} KB`
      : `${(a.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`
    : null;

  function handleDelete() {
    if (!confirm(`Excluir anexo "${a.file_name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteLessonAttachmentAction(a.id, lessonId, moduleId, courseId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao excluir.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-npb-border bg-npb-bg3 p-2.5">
      <FileText className="h-4 w-4 flex-shrink-0 text-npb-text-muted" />
      <div className="min-w-0 flex-1">
        <a
          href={a.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-sm font-medium text-npb-text hover:text-npb-gold"
        >
          {a.file_name}
        </a>
        {sizeLabel && (
          <p className="text-[10px] uppercase tracking-wide text-npb-text-muted">
            {sizeLabel}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        title="Excluir anexo"
        aria-label="Excluir anexo"
        className="flex h-8 w-8 items-center justify-center rounded text-npb-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
