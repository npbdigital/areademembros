"use client";

import { useFormState } from "react-dom";
import { AlertCircle, KeyRound } from "lucide-react";
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
  const defaultCheckedIds = defaultCohortId ? new Set([defaultCohortId]) : new Set<string>();
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <div className="space-y-1.5">
            <Label htmlFor="role" className="text-npb-text">
              Função
            </Label>
            <select
              id="role"
              name="role"
              defaultValue="student"
              className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim focus:ring-1 focus:ring-npb-gold-dim"
            >
              <option value="student">Aluno</option>
              <option value="moderator">Moderador</option>
              <option value="ficticio">Fictício (teste)</option>
            </select>
            <p className="text-[10px] text-npb-text-muted">
              Moderador acessa todos os cursos + comunidade. Fictício se
              comporta como aluno; serve só pra você testar/popular sem sujar
              relatórios reais.
            </p>
          </div>
        </div>

        <fieldset className="space-y-3 rounded-md border border-npb-border bg-npb-bg3 p-4">
          <legend className="-ml-1 px-1 text-sm font-medium text-npb-text">
            Matrículas (opcional)
          </legend>
          <p className="text-[11px] text-npb-text-muted">
            Marque uma ou mais turmas. A duração do acesso de cada matrícula é
            definida pela turma (configurada em <code>/admin/cohorts</code>).
          </p>
          {cohortOptions.length === 0 ? (
            <p className="text-xs text-npb-text-muted italic">
              Nenhuma turma cadastrada.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 max-h-64 overflow-y-auto npb-scrollbar pr-1">
              {cohortOptions.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-npb-border bg-npb-bg2 px-3 py-2 text-sm text-npb-text transition hover:border-npb-gold-dim"
                >
                  <input
                    type="checkbox"
                    name="cohort_ids"
                    value={c.id}
                    defaultChecked={defaultCheckedIds.has(c.id)}
                    className="h-4 w-4 accent-npb-gold"
                  />
                  <span className="truncate">{c.name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="flex items-start gap-2 rounded-md border border-npb-gold/40 bg-npb-gold/5 p-3 text-xs text-npb-text">
          <KeyRound className="mt-0.5 h-4 w-4 flex-shrink-0 text-npb-gold" />
          <div>
            <strong className="text-npb-gold">Senha padrão:</strong> todo aluno
            criado por aqui recebe a senha <code className="rounded bg-npb-bg3 px-1.5 py-0.5 font-mono">123456</code>. O e-mail de boas-vindas
            mostra essa senha e o link de login. Recomende ao aluno trocar em
            <em> Meu perfil → Trocar senha</em>.
          </div>
        </div>

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
