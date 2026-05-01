"use client";

import { useFormState } from "react-dom";
import { useRef, useEffect } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { CoverUpload } from "@/components/admin/cover-upload";
import type { ActionResult } from "@/app/(admin)/admin/courses/actions";

export interface BannerFormValues {
  image_url?: string | null;
  link_url?: string | null;
  link_target?: string | null;
  is_active?: boolean | null;
}

interface BannerFormProps {
  action: (
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  initialValues?: BannerFormValues;
  submitLabel: string;
  successMessage?: string;
  /** Quando true, reseta o form em sucesso (modo "add") */
  resetOnSuccess?: boolean;
}

export function BannerForm({
  action,
  initialValues,
  submitLabel,
  successMessage,
  resetOnSuccess,
}: BannerFormProps) {
  const [state, formAction] = useFormState(action, null);
  const init = initialValues ?? {};
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.ok) {
      formRef.current?.reset();
    }
  }, [resetOnSuccess, state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <Label className="text-npb-text">
          Imagem do banner <span className="text-npb-gold">*</span>
        </Label>
        <CoverUpload
          name="image_url"
          defaultValue={init.image_url}
          recommendedWidth={1280}
          recommendedHeight={400}
          label="Banner"
        />
        <p className="text-xs text-npb-text-muted">
          Recomendado 1280×400 (proporção ~16:5).
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="link_url" className="text-npb-text">
          Link de destino (opcional)
        </Label>
        <Input
          id="link_url"
          name="link_url"
          type="url"
          defaultValue={init.link_url ?? ""}
          placeholder="https://..."
          className="bg-npb-bg3 border-npb-border text-npb-text"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="link_target" className="text-npb-text">
          Abrir em
        </Label>
        <select
          id="link_target"
          name="link_target"
          defaultValue={init.link_target ?? "_blank"}
          className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim focus:ring-1 focus:ring-npb-gold-dim"
        >
          <option value="_blank">Nova aba</option>
          <option value="_self">Mesma aba</option>
        </select>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-npb-border bg-npb-bg3 p-3 transition-colors hover:border-npb-gold-dim">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={init.is_active ?? true}
          className="mt-0.5 h-4 w-4 accent-npb-gold"
        />
        <div className="flex-1">
          <div className="text-sm font-medium text-npb-text">Ativo</div>
          <div className="text-xs text-npb-text-muted">
            Aparece pros alunos no carousel acima dos módulos.
          </div>
        </div>
      </label>

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
        <SubmitButton pendingLabel="Salvando...">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
