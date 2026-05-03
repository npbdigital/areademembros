"use client";

import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { CoverUpload } from "@/components/admin/cover-upload";
import type { ActionResult } from "@/app/(admin)/admin/courses/actions";

export interface CourseFormValues {
  title?: string | null;
  description?: string | null;
  cover_url?: string | null;
  is_published?: boolean | null;
  is_for_sale?: boolean | null;
  sale_url?: string | null;
  welcome_popup_enabled?: boolean | null;
  welcome_popup_title?: string | null;
  welcome_popup_description?: string | null;
  welcome_popup_video_id?: string | null;
  welcome_popup_terms?: string | null;
  welcome_popup_button_label?: string | null;
}

interface CourseFormProps {
  action: (
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  initialValues?: CourseFormValues;
  submitLabel: string;
  pendingLabel?: string;
  successMessage?: string;
}

export function CourseForm({
  action,
  initialValues,
  submitLabel,
  pendingLabel,
  successMessage,
}: CourseFormProps) {
  const [state, formAction] = useFormState(action, null);
  const init = initialValues ?? {};

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
        <Label className="text-npb-text">Capa do curso</Label>
        <CoverUpload
          name="cover_url"
          defaultValue={init.cover_url}
          recommendedWidth={300}
          recommendedHeight={420}
          label="Capa do curso"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Toggle
          name="is_published"
          defaultChecked={Boolean(init.is_published)}
          label="Publicado"
          help="Aparece para os alunos com matrícula."
        />
        <Toggle
          name="is_for_sale"
          defaultChecked={Boolean(init.is_for_sale)}
          label="À venda"
          help="Aparece como card 'Saiba Mais' na biblioteca."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sale_url" className="text-npb-text">
          URL de venda
        </Label>
        <Input
          id="sale_url"
          name="sale_url"
          type="url"
          defaultValue={init.sale_url ?? ""}
          placeholder="https://..."
          className="bg-npb-bg3 border-npb-border text-npb-text"
        />
        <p className="text-xs text-npb-text-muted">
          Usada quando &quot;À venda&quot; está ligado.
        </p>
      </div>

      <fieldset className="space-y-4 rounded-2xl border border-npb-border bg-npb-bg3 p-5">
        <legend className="-ml-2 px-2 text-xs font-semibold uppercase tracking-wide text-npb-gold">
          Pop-up de boas-vindas (1ª vez no curso)
        </legend>

        <Toggle
          name="welcome_popup_enabled"
          defaultChecked={Boolean(init.welcome_popup_enabled)}
          label="Mostrar popup quando aluno abrir o curso pela 1ª vez"
          help="Após aceitar uma vez, o aluno não vê de novo nesse curso."
        />

        <div className="space-y-1.5">
          <Label htmlFor="welcome_popup_title" className="text-npb-text">
            Título do popup
          </Label>
          <Input
            id="welcome_popup_title"
            name="welcome_popup_title"
            defaultValue={init.welcome_popup_title ?? ""}
            placeholder={`Bem-vindo a ${init.title ?? "este curso"}`}
            className="bg-npb-bg2 border-npb-border text-npb-text"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="welcome_popup_description" className="text-npb-text">
            Descrição (subtítulo)
          </Label>
          <textarea
            id="welcome_popup_description"
            name="welcome_popup_description"
            defaultValue={init.welcome_popup_description ?? ""}
            rows={2}
            placeholder="Mensagem curta de boas-vindas"
            className="w-full rounded-md border border-npb-border bg-npb-bg2 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="welcome_popup_video_id" className="text-npb-text">
            ID do vídeo YouTube (opcional)
          </Label>
          <Input
            id="welcome_popup_video_id"
            name="welcome_popup_video_id"
            defaultValue={init.welcome_popup_video_id ?? ""}
            placeholder="dQw4w9WgXcQ"
            className="bg-npb-bg2 border-npb-border text-npb-text font-mono"
          />
          <p className="text-[11px] text-npb-text-muted">
            Só o ID — sem URL completa. O player aparece no topo do popup.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="welcome_popup_terms" className="text-npb-text">
            Termos / texto longo (opcional)
          </Label>
          <textarea
            id="welcome_popup_terms"
            name="welcome_popup_terms"
            defaultValue={init.welcome_popup_terms ?? ""}
            rows={6}
            placeholder="Cole aqui os termos que o aluno precisa aceitar antes de acessar o curso. Quando vazio, o checkbox de aceite é escondido."
            className="w-full rounded-md border border-npb-border bg-npb-bg2 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="welcome_popup_button_label" className="text-npb-text">
            Texto do botão de aceite
          </Label>
          <Input
            id="welcome_popup_button_label"
            name="welcome_popup_button_label"
            defaultValue={init.welcome_popup_button_label ?? ""}
            placeholder="Vamos começar"
            className="bg-npb-bg2 border-npb-border text-npb-text"
          />
        </div>
      </fieldset>

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
        <SubmitButton pendingLabel={pendingLabel ?? "Salvando..."}>
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

function Toggle({
  name,
  defaultChecked,
  label,
  help,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  help?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-npb-border bg-npb-bg3 p-3 transition-colors hover:border-npb-gold-dim">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 accent-npb-gold"
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-npb-text">{label}</div>
        {help && <div className="text-xs text-npb-text-muted">{help}</div>}
      </div>
    </label>
  );
}
