"use client";

import { useFormState } from "react-dom";
import { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { DripFields, type ReleaseType } from "@/components/admin/drip-fields";
import { CoverUpload } from "@/components/admin/cover-upload";
import type { ActionResult } from "@/app/(admin)/admin/courses/actions";

export interface ModuleFormValues {
  title?: string | null;
  description?: string | null;
  cover_url?: string | null;
  release_type?: string | null;
  release_days?: number | null;
  release_date?: string | null;
}

interface ModuleFormProps {
  action: (
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  initialValues?: ModuleFormValues;
  submitLabel: string;
  successMessage?: string;
}

export function ModuleForm({
  action,
  initialValues,
  submitLabel,
  successMessage,
}: ModuleFormProps) {
  const [state, formAction] = useFormState(action, null);
  const init = initialValues ?? {};
  const [releaseType, setReleaseType] = useState<ReleaseType>(
    (init.release_type as ReleaseType) || "immediate",
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="space-y-1.5">
        <Label htmlFor="title" className="text-npb-text">
          Título <span className="text-npb-gold">*</span>
        </Label>
        <Input
          id="title"
          name="title"
          defaultValue={init.title ?? ""}
          required
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
          className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim focus:ring-1 focus:ring-npb-gold-dim"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-npb-text">Capa do módulo</Label>
        <CoverUpload
          name="cover_url"
          defaultValue={init.cover_url}
          recommendedWidth={300}
          recommendedHeight={420}
          label="Capa do módulo"
        />
      </div>

      <DripFields
        value={releaseType}
        onChange={setReleaseType}
        defaultDays={init.release_days ?? null}
        defaultDate={init.release_date ?? null}
      />

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
