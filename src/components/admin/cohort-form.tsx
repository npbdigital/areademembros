"use client";

import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { CohortDurationField } from "@/components/admin/cohort-duration-field";
import type { ActionResult } from "@/app/(admin)/admin/cohorts/actions";

export interface CohortFormValues {
  name?: string | null;
  description?: string | null;
  default_duration_days?: number | null;
}

interface CohortFormProps {
  action: (
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  initialValues?: CohortFormValues;
  submitLabel: string;
  successMessage?: string;
}

export function CohortForm({
  action,
  initialValues,
  submitLabel,
  successMessage,
}: CohortFormProps) {
  const [state, formAction] = useFormState(action, null);
  const init = initialValues ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-npb-text">
          Nome <span className="text-npb-gold">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          defaultValue={init.name ?? ""}
          required
          placeholder="Ex: Turma Setembro 2026 — Low Ticket"
          className="bg-npb-bg3 border-npb-border text-npb-text"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-npb-text">
          Descrição
        </Label>
        <textarea
          id="description"
          name="description"
          defaultValue={init.description ?? ""}
          rows={3}
          placeholder="Notas internas sobre a turma (não aparece pro aluno)"
          className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim focus:ring-1 focus:ring-npb-gold-dim"
        />
      </div>

      <CohortDurationField defaultValue={init.default_duration_days} />

      {state?.error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state?.ok && successMessage && (
        <div className="flex items-start gap-2 rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
