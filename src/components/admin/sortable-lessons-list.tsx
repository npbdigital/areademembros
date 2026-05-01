"use client";

import Link from "next/link";
import { useTransition } from "react";
import {
  ChevronRight,
  Clock,
  Lock,
  PlayCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { SortableList } from "@/components/admin/sortable-list";
import { deleteLessonAction } from "@/app/(admin)/admin/courses/actions";

export interface SortableLesson {
  id: string;
  title: string;
  position: number | null;
  release_type: string | null;
  youtube_video_id: string | null;
  duration_seconds: number | null;
}

interface Props {
  courseId: string;
  moduleId: string;
  lessons: SortableLesson[];
}

export function SortableLessonsList({ courseId, moduleId, lessons }: Props) {
  return (
    <SortableList
      table="lessons"
      items={lessons}
      revalidatePaths={[`/admin/courses/${courseId}/modules/${moduleId}`]}
      className="divide-y divide-npb-border"
      renderItem={(l) => (
        <LessonRowContent
          lesson={l}
          courseId={courseId}
          moduleId={moduleId}
        />
      )}
    />
  );
}

function LessonRowContent({
  lesson,
  courseId,
  moduleId,
}: {
  lesson: SortableLesson;
  courseId: string;
  moduleId: string;
}) {
  const isLocked = lesson.release_type === "locked";
  const hasVideo = Boolean(lesson.youtube_video_id);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Excluir a aula "${lesson.title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteLessonAction(lesson.id, moduleId, courseId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao excluir.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-12 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-npb-bg3">
        {hasVideo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://i.ytimg.com/vi/${lesson.youtube_video_id}/mqdefault.jpg`}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <PlayCircle className="h-5 w-5 text-npb-text-muted opacity-50" />
        )}
      </div>

      <Link
        href={`/admin/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`}
        className="group flex flex-1 items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-npb-text group-hover:text-npb-gold">
              {lesson.title}
            </span>
            {isLocked && (
              <span className="inline-flex items-center gap-0.5 rounded bg-npb-bg3 px-1.5 py-0.5 text-[10px] font-medium text-npb-text-muted">
                <Lock className="h-2.5 w-2.5" />
                bloqueado
              </span>
            )}
            {!hasVideo && (
              <span className="inline-flex items-center gap-0.5 rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400">
                sem vídeo
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-npb-text-muted">
            {lesson.duration_seconds ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(lesson.duration_seconds)}
              </span>
            ) : null}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-npb-text-muted group-hover:text-npb-gold" />
      </Link>

      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        title="Excluir aula"
        aria-label="Excluir aula"
        className="flex h-8 w-8 items-center justify-center rounded text-npb-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
