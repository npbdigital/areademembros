"use client";

import { useTransition } from "react";
import { Ban, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  cancelLiveSessionAction,
  deleteLiveSessionAction,
} from "@/app/(admin)/admin/live-sessions/actions";

interface Props {
  sessionId: string;
  /** Status COMPUTADO (scheduled | live | ended | cancelled), não o do DB. */
  status: string;
}

/**
 * Ações da linha do admin: cancelar (override pra 'cancelled') e excluir.
 * Não tem mais "Iniciar"/"Encerrar" — status agora é derivado de
 * scheduled_at + duration. Cron lida com transição automática + notif.
 */
export function LiveSessionRowActions({ sessionId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleCancel() {
    if (!confirm("Cancelar esta monitoria? Aluno vê como cancelada.")) return;
    startTransition(async () => {
      const res = await cancelLiveSessionAction(sessionId);
      if (res.ok) {
        toast.success("Cancelada.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Excluir esta monitoria? (Sem volta.)")) return;
    startTransition(async () => {
      const res = await deleteLiveSessionAction(sessionId);
      if (res.ok) {
        toast.success("Excluída.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  // Já cancelada/encerrada: só excluir
  if (status === "cancelled" || status === "ended") {
    return (
      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          title="Excluir"
          className="rounded-md p-1.5 text-npb-text-muted hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    );
  }

  // scheduled ou live: pode cancelar ou excluir
  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={handleCancel}
        disabled={pending}
        title="Cancelar (aluno vê como cancelada)"
        className="inline-flex items-center gap-1.5 rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-xs font-semibold text-npb-text-muted hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Ban className="h-3.5 w-3.5" />
        )}
        Cancelar
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        title="Excluir"
        className="rounded-md p-1.5 text-npb-text-muted hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
