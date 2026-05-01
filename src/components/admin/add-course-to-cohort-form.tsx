"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import type { ActionResult } from "@/app/(admin)/admin/cohorts/actions";

interface CourseOption {
  id: string;
  title: string;
  is_published?: boolean | null;
}

interface AddCourseToCohortFormProps {
  action: (
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  options: CourseOption[];
}

export function AddCourseToCohortForm({
  action,
  options,
}: AddCourseToCohortFormProps) {
  const [state, formAction] = useFormState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-2"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,auto,auto]">
        <select
          name="course_id"
          required
          defaultValue=""
          className="rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
        >
          <option value="" disabled>
            Selecione um curso...
          </option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
              {c.is_published === false && " (rascunho)"}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text">
          <input
            type="checkbox"
            name="has_community_access"
            className="h-3.5 w-3.5 accent-npb-gold"
          />
          Comunidade
        </label>
        <SubmitInline />
      </div>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
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
      {pending ? "Vinculando..." : "Vincular"}
    </button>
  );
}
