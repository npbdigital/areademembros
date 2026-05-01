"use client";

import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/app/(admin)/admin/students/actions";

export interface StudentEditFormValues {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean | null;
}

interface StudentEditFormProps {
  action: (
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  initialValues: StudentEditFormValues;
}

export function StudentEditForm({
  action,
  initialValues: init,
}: StudentEditFormProps) {
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="full_name" className="text-npb-text">
            Nome completo <span className="text-npb-gold">*</span>
          </Label>
          <Input
            id="full_name"
            name="full_name"
            defaultValue={init.full_name ?? ""}
            required
            className="bg-npb-bg3 border-npb-border text-npb-text"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-npb-text">E-mail (read-only)</Label>
          <Input
            value={init.email ?? ""}
            readOnly
            disabled
            className="bg-npb-bg2 border-npb-border text-npb-text-muted"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone" className="text-npb-text">
          Telefone
        </Label>
        <Input
          id="phone"
          name="phone"
          defaultValue={init.phone ?? ""}
          placeholder="+55 11 99999-9999"
          className="bg-npb-bg3 border-npb-border text-npb-text"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-npb-border bg-npb-bg3 p-3">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={init.is_active !== false}
          className="mt-0.5 h-4 w-4 accent-npb-gold"
        />
        <div className="flex-1">
          <div className="text-sm font-medium text-npb-text">Ativo</div>
          <div className="text-xs text-npb-text-muted">
            Desmarque pra bloquear o acesso (login fica negado, matrículas
            preservadas).
          </div>
        </div>
      </label>

      {state?.error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state?.ok && (
        <div className="flex items-start gap-2 rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Aluno atualizado.</span>
        </div>
      )}

      <div>
        <SubmitButton>Salvar alterações</SubmitButton>
      </div>
    </form>
  );
}
