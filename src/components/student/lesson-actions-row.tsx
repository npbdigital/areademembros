"use client";

import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, Check, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  toggleCompleteAction,
  toggleFavoriteAction,
} from "@/app/(student)/lessons/actions";

interface Props {
  lessonId: string;
  initialCompleted: boolean;
  initialFavorite: boolean;
}

export function LessonActionsRow({
  lessonId,
  initialCompleted,
  initialFavorite,
}: Props) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [favorite, setFavorite] = useState(initialFavorite);
  const [pending, startTransition] = useTransition();

  function handleToggleComplete() {
    const next = !completed;
    setCompleted(next);
    startTransition(async () => {
      const res = await toggleCompleteAction(lessonId, next);
      if (!res.ok) {
        setCompleted(!next);
        toast.error(res.error ?? "Não foi possível salvar.");
      } else {
        toast.success(next ? "Aula marcada como concluída!" : "Marcação removida.");
      }
    });
  }

  function handleToggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    startTransition(async () => {
      const res = await toggleFavoriteAction(lessonId, next);
      if (!res.ok) {
        setFavorite(!next);
        toast.error(res.error ?? "Não foi possível salvar.");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={handleToggleComplete}
        disabled={pending}
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50 sm:px-4 sm:text-sm ${
          completed
            ? "bg-npb-gold text-black hover:bg-npb-gold-light"
            : "border border-npb-border bg-npb-bg2 text-npb-text hover:border-npb-gold"
        }`}
      >
        {completed ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            <span className="sm:hidden">Concluída</span>
            <span className="hidden sm:inline">Aula concluída</span>
          </>
        ) : (
          <>
            <Check className="h-4 w-4" />
            <span className="sm:hidden">Concluir</span>
            <span className="hidden sm:inline">Marcar como concluída</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={handleToggleFavorite}
        disabled={pending}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 sm:px-4 sm:text-sm ${
          favorite
            ? "border-npb-gold bg-npb-gold/10 text-npb-gold"
            : "border-npb-border bg-npb-bg2 text-npb-text hover:border-npb-gold"
        }`}
      >
        {favorite ? (
          <>
            <BookmarkCheck className="h-4 w-4" />
            <span className="sm:hidden">Favorito</span>
            <span className="hidden sm:inline">Nos favoritos</span>
          </>
        ) : (
          <>
            <Bookmark className="h-4 w-4" />
            <span className="sm:hidden">Favoritar</span>
            <span className="hidden sm:inline">Salvar nos favoritos</span>
          </>
        )}
      </button>
    </div>
  );
}
