"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ChevronRight, Layers, Lock, PlayCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SortableList } from "@/components/admin/sortable-list";
import { QuickEditModuleButton } from "@/components/admin/quick-edit-module-modal";
import { deleteModuleAction } from "@/app/(admin)/admin/courses/actions";

export interface SortableModule {
  id: string;
  title: string;
  position: number | null;
  release_type: string | null;
  cover_url: string | null;
}

interface Props {
  courseId: string;
  modules: SortableModule[];
  lessonCounts: Record<string, number>;
}

export function SortableModulesList({
  courseId,
  modules,
  lessonCounts,
}: Props) {
  return (
    <SortableList
      table="modules"
      items={modules}
      revalidatePaths={[`/admin/courses/${courseId}`]}
      className="divide-y divide-npb-border"
      renderItem={(m) => (
        <ModuleRowContent
          module={m}
          courseId={courseId}
          lessonCount={lessonCounts[m.id] ?? 0}
        />
      )}
    />
  );
}

function ModuleRowContent({
  module: m,
  courseId,
  lessonCount,
}: {
  module: SortableModule;
  courseId: string;
  lessonCount: number;
}) {
  const isLocked = m.release_type === "locked";
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (
      !confirm(
        `Excluir o módulo "${m.title}"? As aulas dentro dele também serão removidas.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteModuleAction(m.id, courseId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao excluir.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3 py-3">
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
        className="group flex flex-1 items-center justify-between gap-3"
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

      <QuickEditModuleButton
        moduleId={m.id}
        courseId={courseId}
        initialTitle={m.title}
        initialCoverUrl={m.cover_url}
      />

      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        title="Excluir módulo"
        aria-label="Excluir módulo"
        className="flex h-8 w-8 items-center justify-center rounded text-npb-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
