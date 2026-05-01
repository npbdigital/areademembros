"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, PlaySquare } from "lucide-react";
import { toast } from "sonner";
import { reorderEntitiesAction } from "@/app/(admin)/admin/courses/actions";
import { QuickEditModuleButton } from "@/components/admin/quick-edit-module-modal";

export interface AdminModuleCard {
  id: string;
  title: string;
  cover_url: string | null;
  totalLessons: number;
  firstLessonId: string | undefined;
}

interface Props {
  courseId: string;
  modules: AdminModuleCard[];
}

export function SortableModulesGrid({
  courseId,
  modules: initialModules,
}: Props) {
  const [modules, setModules] = useState(initialModules);
  const [pending, startTransition] = useTransition();

  if (
    initialModules.length !== modules.length ||
    initialModules.some((m, i) => m.id !== modules[i]?.id)
  ) {
    if (!pending) setModules(initialModules);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const ids = useMemo(() => modules.map((m) => m.id), [modules]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = modules;
    const next = arrayMove(modules, oldIndex, newIndex);
    setModules(next);

    startTransition(async () => {
      const res = await reorderEntitiesAction(
        "modules",
        next.map((m) => m.id),
        [`/admin/courses/${courseId}`, `/courses/${courseId}`],
      );
      if (!res.ok) {
        setModules(previous);
        toast.error(res.error ?? "Não foi possível reordenar.");
      }
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {modules.map((m) => (
            <SortableModuleCard
              key={m.id}
              module={m}
              courseId={courseId}
              disabled={pending}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableModuleCard({
  module: m,
  courseId,
  disabled,
}: {
  module: AdminModuleCard;
  courseId: string;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: m.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  const Inner = (
    <>
      <div className="relative aspect-[5/7] w-full overflow-hidden bg-npb-bg3">
        {m.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.cover_url}
            alt={m.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wide text-npb-text-muted">
            Sem capa
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-npb-text">
          {m.title}
        </h3>
        <div className="mt-3 flex items-center justify-between text-xs text-npb-text-muted">
          <span className="inline-flex items-center gap-1">
            <PlaySquare className="h-3.5 w-3.5" />
            {m.totalLessons} {m.totalLessons === 1 ? "aula" : "aulas"}
          </span>
        </div>
      </div>
    </>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative block overflow-hidden rounded-xl border border-npb-border bg-npb-bg2 transition ${
        isDragging
          ? "shadow-2xl ring-2 ring-npb-gold/50"
          : "hover:border-npb-gold/60 hover:shadow-npb-card-hover"
      }`}
    >
      {m.firstLessonId ? (
        <Link
          href={`/lessons/${m.firstLessonId}`}
          className="flex flex-col"
        >
          {Inner}
        </Link>
      ) : (
        <div className="flex flex-col">{Inner}</div>
      )}

      {/* Controls de admin: handle + lápis */}
      <div className="absolute right-2 top-2 flex gap-1">
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <QuickEditModuleButton
            moduleId={m.id}
            courseId={courseId}
            initialTitle={m.title}
            initialCoverUrl={m.cover_url}
          />
        </div>
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={disabled}
          title="Arrastar para reordenar"
          aria-label="Arrastar para reordenar"
          className="flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80 hover:text-npb-gold active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
