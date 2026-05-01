"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/app/(admin)/admin/cohorts/actions";

interface StudentOption {
  id: string;
  full_name: string;
  email: string;
}

interface EnrollExistingStudentFormProps {
  action: (
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  options: StudentOption[];
}

export function EnrollExistingStudentForm({
  action,
  options,
}: EnrollExistingStudentFormProps) {
  const [state, formAction] = useFormState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  if (options.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-npb-border bg-npb-bg3 px-3 py-3 text-xs text-npb-text-muted">
        Nenhum aluno cadastrado ainda. Crie alunos em{" "}
        <a
          href="/admin/students/new"
          className="text-npb-gold hover:text-npb-gold-light"
        >
          /admin/students/new
        </a>
        .
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,160px,auto]">
        <select
          name="user_id"
          required
          defaultValue=""
          className="rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
        >
          <option value="" disabled>
            Selecione um aluno...
          </option>
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name} — {s.email}
            </option>
          ))}
        </select>
        <Input
          name="expires_at"
          type="date"
          title="Expira em (opcional)"
          className="bg-npb-bg3 border-npb-border text-npb-text"
        />
        <SubmitInline />
      </div>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
      {state?.ok && (
        <p className="text-xs text-green-400">Aluno matriculado.</p>
      )}
    </form>
  );
}

function SubmitInline() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-npb-gold px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-npb-gold-light disabled:opacity-60"
    >
      <Plus className="h-3.5 w-3.5" />
      {pending ? "Matriculando..." : "Matricular"}
    </button>
  );
}
