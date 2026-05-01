"use client";

import { useId, useMemo, useState, useTransition } from "react";
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { reorderEntitiesAction } from "@/app/(admin)/admin/courses/actions";

type SortableTable =
  | "courses"
  | "modules"
  | "lessons"
  | "banners"
  | "lesson_attachments";

interface Props<T extends { id: string }> {
  /** Tabela do banco — define qual schema/coluna a action vai mexer. */
  table: SortableTable;
  /** Itens iniciais (já ordenados pelo servidor). */
  items: T[];
  /** Paths a invalidar após o reorder. */
  revalidatePaths?: string[];
  /** Render do conteúdo do item (sem o handle — o handle é renderizado pela lib). */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Classe extra do <ul>. */
  className?: string;
  /** Classe extra de cada <li>. */
  itemClassName?: string;
}

/**
 * Lista vertical com drag-and-drop. Aplica a nova ordem na hora (otimista) e
 * dispara `reorderEntitiesAction` no servidor. Em caso de erro, reverte.
 */
export function SortableList<T extends { id: string }>({
  table,
  items: initialItems,
  revalidatePaths,
  renderItem,
  className,
  itemClassName,
}: Props<T>) {
  const [items, setItems] = useState(initialItems);
  const [pending, startTransition] = useTransition();

  // Quando a página re-renderiza com props novos (ex: após revalidate), sincroniza
  if (
    initialItems.length !== items.length ||
    initialItems.some((it, i) => it.id !== items[i]?.id)
  ) {
    // Só atualiza se não estamos no meio de uma transition (evita race)
    if (!pending) {
      setItems(initialItems);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const ids = useMemo(() => items.map((i) => i.id), [items]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = items;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);

    startTransition(async () => {
      const res = await reorderEntitiesAction(
        table,
        next.map((i) => i.id),
        revalidatePaths ?? [],
      );
      if (!res.ok) {
        setItems(previous);
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
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item, index) => (
            <SortableRow
              key={item.id}
              id={item.id}
              className={itemClassName}
              disabled={pending}
            >
              {renderItem(item, index)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
  className,
  disabled,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        "flex items-stretch gap-2 rounded-lg px-1 transition-colors",
        isDragging
          ? "shadow-lg bg-npb-bg3"
          : "hover:bg-npb-bg3/40",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <DragHandle
        attributes={attributes}
        listeners={listeners}
        disabled={disabled}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

function DragHandle({
  attributes,
  listeners,
  disabled,
}: {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  disabled?: boolean;
}) {
  const labelId = useId();
  return (
    <button
      type="button"
      {...attributes}
      {...listeners}
      disabled={disabled}
      aria-labelledby={labelId}
      className="group flex w-7 flex-shrink-0 cursor-grab touch-none items-center justify-center rounded text-npb-text-muted transition-colors hover:bg-npb-bg3 hover:text-npb-gold active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span id={labelId} className="sr-only">
        Arrastar para reordenar
      </span>
      <GripVertical className="h-4 w-4" />
    </button>
  );
}
