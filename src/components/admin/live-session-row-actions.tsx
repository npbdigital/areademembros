"use client";

import { useTransition } from "react";
import { Loader2, PlayCircle, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  deleteLiveSessionAction,
  endLiveSessionAction,
  startLiveSessionAction,
} from "@/app/(admin)/admin/live-sessions/actions";

interface Props {
  sessionId: string;
  status: string;
}

export function LiveSessionRowActions({ sessionId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleStart() {
    if (
      !confirm(
        "Iniciar agora? Os alunos da turma vão receber notificação push imediatamente.",
      )
    )
      return;
    startTransition(async () => {
      const res = await startLiveSessionAction(sessionId);
      if (res.ok) {
        toast.success("Monitoria ao vivo. Alunos notificados.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  function handleEnd() {
    if (!confirm("Encerrar a monitoria? Aluno deixa de ver na lista.")) return;
    startTransition(async () => {
      const res = await endLiveSessionAction(sessionId);
      if (res.ok) {
        toast.success("Monitoria encerrada.");
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

  if (status === "scheduled") {
    return (
      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleStart}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PlayCircle className="h-3.5 w-3.5" />
          )}
          Iniciar agora
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

  if (status === "live") {
    return (
      <div className="flex flex-shrink-0 items-center gap-2">
        <a
          href={`/monitorias/${sessionId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-npb-gold/40 bg-npb-gold/5 px-3 py-1.5 text-xs font-semibold text-npb-gold hover:bg-npb-gold/15"
        >
          Abrir player
        </a>
        <button
          type="button"
          onClick={handleEnd}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/5 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/15 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
          Encerrar
        </button>
      </div>
    );
  }

  // ended | cancelled
  return (
    <div className="flex flex-shrink-0 items-center gap-2">
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
