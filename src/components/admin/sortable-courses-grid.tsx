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
import { BookOpen, Eye, EyeOff, GripVertical, Tag } from "lucide-react";
import { toast } from "sonner";
import { reorderEntitiesAction } from "@/app/(admin)/admin/courses/actions";

export interface SortableCourse {
  id: string;
  title: string;
  cover_url: string | null;
  is_published: boolean | null;
  is_for_sale: boolean | null;
  position: number | null;
}

interface Props {
  courses: SortableCourse[];
}

export function SortableCoursesGrid({ courses: initialCourses }: Props) {
  const [courses, setCourses] = useState(initialCourses);
  const [pending, startTransition] = useTransition();

  if (
    initialCourses.length !== courses.length ||
    initialCourses.some((c, i) => c.id !== courses[i]?.id)
  ) {
    if (!pending) setCourses(initialCourses);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const ids = useMemo(() => courses.map((c) => c.id), [courses]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = courses.findIndex((c) => c.id === active.id);
    const newIndex = courses.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = courses;
    const next = arrayMove(courses, oldIndex, newIndex);
    setCourses(next);

    startTransition(async () => {
      const res = await reorderEntitiesAction(
        "courses",
        next.map((c) => c.id),
        ["/admin/courses"],
      );
      if (!res.ok) {
        setCourses(previous);
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} disabled={pending} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function CourseCard({
  course,
  disabled,
}: {
  course: SortableCourse;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: course.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-npb-border bg-npb-bg2 transition-all hover:border-npb-gold-dim ${
        isDragging ? "shadow-2xl" : "hover:shadow-npb-card-hover"
      }`}
    >
      <Link
        href={`/admin/courses/${course.id}`}
        className="flex flex-1 flex-col"
      >
        <div className="relative aspect-[5/7] overflow-hidden bg-npb-bg3">
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
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        title="Arrastar para reordenar"
        aria-label="Arrastar para reordenar"
        className="absolute right-2 top-2 flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80 hover:text-npb-gold active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
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
