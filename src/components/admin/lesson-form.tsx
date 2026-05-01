"use client";

import { useFormState } from "react-dom";
import { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { DripFields, type ReleaseType } from "@/components/admin/drip-fields";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import type { ActionResult } from "@/app/(admin)/admin/courses/actions";

export interface LessonFormValues {
  title?: string | null;
  description_html?: string | null;
  youtube_video_id?: string | null;
  duration_seconds?: number | null;
  release_type?: string | null;
  release_days?: number | null;
  release_date?: string | null;
}

interface LessonFormProps {
  action: (
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  initialValues?: LessonFormValues;
  submitLabel: string;
  successMessage?: string;
}

export function LessonForm({
  action,
  initialValues,
  submitLabel,
  successMessage,
}: LessonFormProps) {
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr,160px]">
        <div className="space-y-1.5">
          <Label htmlFor="youtube_video_id" className="text-npb-text">
            ID do vídeo no YouTube
          </Label>
          <Input
            id="youtube_video_id"
            name="youtube_video_id"
            defaultValue={init.youtube_video_id ?? ""}
            placeholder="Ex: dQw4w9WgXcQ"
            className="bg-npb-bg3 border-npb-border text-npb-text font-mono"
          />
          <p className="text-xs text-npb-text-muted">
            Apenas o ID (parte depois de <code>v=</code>). O seletor visual com
            busca no canal entra na Etapa 6.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="duration_seconds" className="text-npb-text">
            Duração (s)
          </Label>
          <Input
            id="duration_seconds"
            name="duration_seconds"
            type="number"
            min={0}
            defaultValue={init.duration_seconds ?? ""}
            placeholder="Ex: 754"
            className="bg-npb-bg3 border-npb-border text-npb-text"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-npb-text">Descrição da aula</Label>
        <RichTextEditor
          name="description_html"
          defaultValue={init.description_html ?? ""}
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
