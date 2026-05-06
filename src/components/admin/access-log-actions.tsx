"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  approveManuallyAction,
  deleteEventAction,
  retryEventAction,
} from "@/app/(admin)/admin/access-logs/actions";

interface CohortInfo {
  id: string;
  name: string;
  default_duration_days: number | null;
}

interface Props {
  eventId: string;
  status: string;
  isApproved: boolean;
  cohorts: CohortInfo[];
}

/**
 * Botões de ação na linha do log:
 *  - "Aprovar manualmente" pra eventos com status='unmapped' (Compra
 *    Aprovada que não tem mapeamento) — admin escolhe a cohort destino
 *  - "Tentar de novo" pra eventos com status='failed'
 */
export function AccessLogActions({
  eventId,
  status,
  isApproved,
  cohorts,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [approving, setApproving] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [expiresDaysStr, setExpiresDaysStr] = useState("");

  function handleApprove() {
    if (!selectedCohortId) {
      toast.error("Selecione uma turma.");
      return;
    }
    const days = expiresDaysStr.trim()
      ? parseInt(expiresDaysStr, 10)
      : null;
    startTransition(async () => {
      const res = await approveManuallyAction({
        eventId,
        cohortId: selectedCohortId,
        expiresDays: days,
      });
      if (res.ok) {
        toast.success("Aluno cadastrado e mapeamento salvo.");
        setApproving(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  function handleRetry() {
    startTransition(async () => {
      const res = await retryEventAction(eventId);
      if (res.ok) {
        toast.success("Reprocessado.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  function handleDelete() {
    if (
      !confirm(
        "Apagar esse evento do log? Não desfaz cadastro/matrícula — só remove o registro.",
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteEventAction(eventId);
      if (res.ok) {
        toast.success("Evento apagado.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  if (approving) {
    return (
      <div className="flex w-full flex-shrink-0 flex-col gap-2 rounded-md border border-npb-border bg-npb-bg3 p-3 sm:w-auto sm:min-w-[300px]">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_100px]">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-npb-text-muted">
              Turma
            </label>
            <select
              value={selectedCohortId}
              onChange={(e) => {
                setSelectedCohortId(e.target.value);
                const c = cohorts.find((x) => x.id === e.target.value);
                if (c?.default_duration_days && !expiresDaysStr) {
                  setExpiresDaysStr(String(c.default_duration_days));
                }
              }}
              className="w-full rounded-md border border-npb-border bg-npb-bg2 px-2 py-1.5 text-xs text-npb-text outline-none focus:border-npb-gold-dim"
            >
              <option value="">— Selecione —</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-npb-text-muted">
              Dias
            </label>
            <input
              type="number"
              min={0}
              value={expiresDaysStr}
              onChange={(e) => setExpiresDaysStr(e.target.value)}
              placeholder="(default)"
              className="w-full rounded-md border border-npb-border bg-npb-bg2 px-2 py-1.5 text-xs text-npb-text outline-none focus:border-npb-gold-dim"
            />
          </div>
        </div>
        <p className="rounded border border-npb-gold/30 bg-npb-gold/5 p-2 text-[10px] text-npb-text">
          ⚡ <strong className="text-npb-gold">Importante:</strong> isso cria o
          mapeamento permanente desse produto pra essa turma. Toda venda
          futura dele entra direto sem precisar aprovar de novo.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setApproving(false)}
            disabled={pending}
            className="rounded-md px-2 py-1 text-xs text-npb-text-muted hover:text-npb-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={pending || !selectedCohortId}
            className="inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-3 py-1.5 text-xs font-bold text-black hover:bg-npb-gold-light disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            Aprovar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      {isApproved && status === "unmapped" && (
        <button
          type="button"
          onClick={() => setApproving(true)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-1.5 text-xs font-bold text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-50"
        >
          <CheckCircle2 className="h-3 w-3" />
          Mapear produto + aprovar
        </button>
      )}
      {status === "failed" && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-xs font-semibold text-npb-text hover:border-npb-gold-dim hover:text-npb-gold disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Tentar de novo
        </button>
      )}
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        title="Apagar evento do log"
        className="rounded-md p-1.5 text-npb-text-muted hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
