"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import {
  type ActionResult,
  addEnrollmentsAction,
} from "@/app/(admin)/admin/students/actions";

interface AddEnrollmentsFormProps {
  userId: string;
  availableCohorts: Array<{ id: string; name: string }>;
}

export function AddEnrollmentsForm({
  userId,
  availableCohorts,
}: AddEnrollmentsFormProps) {
  const action = addEnrollmentsAction.bind(null, userId);
  const [state, formAction] = useFormState<
    ActionResult<{ added: number }> | null,
    FormData
  >(action, null);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      toast.success(
        `Matrícula adicionada${(state.data?.added ?? 0) > 1 ? "s" : ""} com sucesso.`,
      );
      setOpen(false);
    }
  }, [state]);

  if (availableCohorts.length === 0) {
    return (
      <p className="rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-xs text-npb-text-muted">
        Aluno já está matriculado em todas as turmas existentes.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-xs font-semibold text-npb-text transition hover:border-npb-gold"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar matrícula
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-npb-border bg-npb-bg3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-npb-text">
          Selecione uma ou mais turmas
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-npb-text-muted hover:text-npb-text"
        >
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 max-h-64 overflow-y-auto npb-scrollbar pr-1">
        {availableCohorts.map((c) => (
          <label
            key={c.id}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-npb-border bg-npb-bg2 px-3 py-2 text-sm text-npb-text transition hover:border-npb-gold-dim"
          >
            <input
              type="checkbox"
              name="cohort_ids"
              value={c.id}
              className="h-4 w-4 accent-npb-gold"
            />
            <span className="truncate">{c.name}</span>
          </label>
        ))}
      </div>

      <p className="text-[11px] text-npb-text-muted">
        A duração de cada matrícula segue a configuração da turma. Reativar
        uma matrícula inativa renova o prazo a partir de hoje.
      </p>

      {state?.error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {state?.ok && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 p-2 text-xs text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {state.data?.added} matrícula(s) registradas.
        </div>
      )}

      <SubmitButton pendingLabel="Matriculando...">
        Matricular
      </SubmitButton>
    </form>
  );
}
