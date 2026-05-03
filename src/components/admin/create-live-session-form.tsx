"use client";

import { useFormState } from "react-dom";
import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import {
  type ActionResult,
  createLiveSessionAction,
} from "@/app/(admin)/admin/live-sessions/actions";
import {
  type CohortOption,
  CohortMultiSelect,
} from "@/components/admin/cohort-multi-select";

interface Props {
  cohorts: CohortOption[];
}

export function CreateLiveSessionForm({ cohorts }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState<
    ActionResult<{ id: string }> | null,
    FormData
  >(createLiveSessionAction, null);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Monitoria criada.");
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  if (cohorts.length === 0) {
    return (
      <p className="text-sm text-npb-text-muted">
        Você precisa ter ao menos uma turma cadastrada antes de criar
        monitorias. Vá em <strong>/admin/cohorts</strong>.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-npb-text">
          Turmas <span className="text-npb-gold">*</span>
        </Label>
        <p className="text-[10px] text-npb-text-muted">
          Selecione uma ou mais turmas. Pode buscar por nome ou pelo curso
          atrelado.
        </p>
        <CohortMultiSelect name="cohort_ids" options={cohorts} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title" className="text-npb-text">
          Título <span className="text-npb-gold">*</span>
        </Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={120}
          placeholder="Monitoria semanal — Estratégia"
          className="bg-npb-bg3 border-npb-border text-npb-text"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-npb-text">
          Descrição (opcional)
        </Label>
        <textarea
          id="description"
          name="description"
          maxLength={500}
          rows={2}
          placeholder="Pauta da monitoria, links de apoio, etc."
          className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="scheduled_at" className="text-npb-text">
            Horário previsto (BRT)
          </Label>
          <Input
            id="scheduled_at"
            name="scheduled_at"
            type="datetime-local"
            className="bg-npb-bg3 border-npb-border text-npb-text"
          />
          <p className="text-[10px] text-npb-text-muted">
            Só pra exibir. Liberação é manual.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recurrence" className="text-npb-text">
            Repetir
          </Label>
          <select
            id="recurrence"
            name="recurrence"
            defaultValue="none"
            className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
          >
            <option value="none">Não repetir</option>
            <option value="daily">Diariamente</option>
            <option value="weekly">Semanalmente</option>
            <option value="biweekly">Quinzenalmente</option>
            <option value="monthly">Mensalmente</option>
          </select>
          <p className="text-[10px] text-npb-text-muted">
            Quando você encerrar uma monitoria recorrente, criamos a próxima
            automaticamente com mesmo horário, turmas e Zoom.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="zoom_meeting_id" className="text-npb-text">
            Zoom Meeting ID <span className="text-npb-gold">*</span>
          </Label>
          <Input
            id="zoom_meeting_id"
            name="zoom_meeting_id"
            required
            placeholder="123 456 7890"
            className="bg-npb-bg3 border-npb-border text-npb-text font-mono"
          />
          <p className="text-[10px] text-npb-text-muted">
            ID da reunião no Zoom (10-11 dígitos).
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zoom_password" className="text-npb-text">
            Senha do Meeting
          </Label>
          <Input
            id="zoom_password"
            name="zoom_password"
            placeholder="abc123"
            className="bg-npb-bg3 border-npb-border text-npb-text font-mono"
          />
          <p className="text-[10px] text-npb-text-muted">
            Se a reunião tiver senha.
          </p>
        </div>
      </div>

      {state?.error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state?.ok && (
        <div className="flex items-start gap-2 rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Monitoria criada. Quando for hora, clique em Iniciar.</span>
        </div>
      )}

      <SubmitButton pendingLabel="Criando…">Criar monitoria</SubmitButton>
    </form>
  );
}
