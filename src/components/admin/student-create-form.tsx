"use client";

import { useFormState } from "react-dom";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { InviteLinkCard } from "@/components/admin/invite-link-card";
import {
  type ActionResult,
  type CreateStudentResult,
  createStudentAction,
} from "@/app/(admin)/admin/students/actions";

interface StudentCreateFormProps {
  cohortOptions: Array<{ id: string; name: string }>;
  defaultCohortId?: string;
}

export function StudentCreateForm({
  cohortOptions,
  defaultCohortId,
}: StudentCreateFormProps) {
  const [state, formAction] = useFormState<
    ActionResult<CreateStudentResult> | null,
    FormData
  >(createStudentAction, null);

  // Pega o e-mail do form pra mostrar no card de invite
  const recipientHint = state?.ok ? state.data?.userId : undefined;

  return (
    <div className="space-y-6">
      <form action={formAction} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name" className="text-npb-text">
              Nome completo <span className="text-npb-gold">*</span>
            </Label>
            <Input
              id="full_name"
              name="full_name"
              required
              placeholder="João Silva"
              className="bg-npb-bg3 border-npb-border text-npb-text"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-npb-text">
              E-mail <span className="text-npb-gold">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="aluno@email.com"
              className="bg-npb-bg3 border-npb-border text-npb-text"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-npb-text">
            Telefone (opcional)
          </Label>
          <Input
            id="phone"
            name="phone"
            placeholder="+55 11 99999-9999"
            className="bg-npb-bg3 border-npb-border text-npb-text"
          />
        </div>

        <fieldset className="space-y-3 rounded-md border border-npb-border bg-npb-bg3 p-4">
          <legend className="-ml-1 px-1 text-sm font-medium text-npb-text">
            Matrícula (opcional)
          </legend>
          <div className="space-y-1.5">
            <Label htmlFor="cohort_id" className="text-npb-text-muted text-xs">
              Turma
            </Label>
            <select
              id="cohort_id"
              name="cohort_id"
              defaultValue={defaultCohortId ?? ""}
              className="w-full rounded-md border border-npb-border bg-npb-bg2 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
            >
              <option value="">— Sem matrícula —</option>
              {cohortOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-npb-text-muted">
              A duração do acesso é definida pela turma (configurada em{" "}
              <code>/admin/cohorts</code>).
            </p>
          </div>
        </fieldset>

        {state?.error && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <div>
          <SubmitButton pendingLabel="Criando aluno...">
            Criar e enviar convite
          </SubmitButton>
        </div>
      </form>

      {state?.ok && state.data && (
        <InviteLinkCard
          inviteUrl={state.data.inviteUrl}
          emailSent={state.data.emailSent}
          emailError={state.data.emailError}
          recipient={recipientHint ? undefined : undefined}
        />
      )}
    </div>
  );
}
