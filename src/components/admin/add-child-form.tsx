"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/app/(admin)/admin/courses/actions";

interface AddChildFormProps {
  action: (
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  placeholder: string;
  buttonLabel: string;
}

export function AddChildForm({
  action,
  placeholder,
  buttonLabel,
}: AddChildFormProps) {
  const [state, formAction] = useFormState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Limpa o input após sucesso (sem perder a resposta de erro).
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          name="title"
          placeholder={placeholder}
          required
          className="flex-1 bg-npb-bg3 border-npb-border text-npb-text"
        />
        <SubmitInline label={buttonLabel} />
      </div>
      {state?.error && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}
    </form>
  );
}

function SubmitInline({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-npb-gold-light disabled:opacity-60"
    >
      <Plus className="h-3.5 w-3.5" />
      {pending ? "Adicionando..." : label}
    </button>
  );
}
