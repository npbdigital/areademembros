"use client";

import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { CoverUpload } from "@/components/admin/cover-upload";
import {
  type ActionResult,
  updatePlatformSettingsAction,
} from "@/app/(admin)/admin/settings/actions";

export interface PlatformSettingsFormValues {
  platformName: string;
  platformLogoUrl: string | null;
  emailFromAddress: string | null;
  emailFromName: string | null;
  primaryColor: string | null;
  supportEmail: string | null;
  supportWhatsapp: string | null;
}

export function PlatformSettingsForm({
  initialValues: init,
}: {
  initialValues: PlatformSettingsFormValues;
}) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    updatePlatformSettingsAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* IDENTIDADE */}
      <fieldset className="space-y-4 rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <legend className="-ml-2 px-2 text-xs font-semibold uppercase tracking-wide text-npb-gold">
          Identidade
        </legend>

        <div className="space-y-1.5">
          <Label htmlFor="platform_name" className="text-npb-text">
            Nome da plataforma <span className="text-npb-gold">*</span>
          </Label>
          <Input
            id="platform_name"
            name="platform_name"
            defaultValue={init.platformName}
            required
            className="bg-npb-bg3 border-npb-border text-npb-text"
          />
          <p className="text-xs text-npb-text-muted">
            Aparece no título da janela, e-mails e topbar.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-npb-text">Logo</Label>
          <CoverUpload
            name="platform_logo_url"
            defaultValue={init.platformLogoUrl}
            recommendedWidth={400}
            recommendedHeight={120}
            label="Logo da plataforma"
          />
          <p className="text-xs text-npb-text-muted">
            Formato horizontal, ~400×120 px. Aplicado automaticamente quando
            preenchido (em breve).
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="primary_color" className="text-npb-text">
            Cor primária <span className="text-[10px] text-npb-text-muted">(em breve)</span>
          </Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              id="primary_color"
              name="primary_color"
              defaultValue={init.primaryColor ?? "#c9922a"}
              className="h-10 w-16 cursor-pointer rounded-md border border-npb-border bg-npb-bg3"
            />
            <Input
              defaultValue={init.primaryColor ?? "#c9922a"}
              readOnly
              className="bg-npb-bg3 border-npb-border text-npb-text font-mono"
              onFocus={(e) => e.currentTarget.blur()}
            />
          </div>
          <p className="text-xs text-npb-text-muted">
            Salva o valor mas ainda não aplica em runtime — depende de refator
            do design system pra usar CSS vars.
          </p>
        </div>
      </fieldset>

      {/* E-MAIL */}
      <fieldset className="space-y-4 rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <legend className="-ml-2 px-2 text-xs font-semibold uppercase tracking-wide text-npb-gold">
          E-mail (Resend)
        </legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email_from_name" className="text-npb-text">
              Nome do remetente
            </Label>
            <Input
              id="email_from_name"
              name="email_from_name"
              defaultValue={init.emailFromName ?? ""}
              placeholder="Academia NPB"
              className="bg-npb-bg3 border-npb-border text-npb-text"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email_from_address" className="text-npb-text">
              E-mail do remetente
            </Label>
            <Input
              id="email_from_address"
              name="email_from_address"
              type="email"
              defaultValue={init.emailFromAddress ?? ""}
              placeholder="noreply@seudominio.com.br"
              className="bg-npb-bg3 border-npb-border text-npb-text"
            />
          </div>
        </div>
        <p className="text-xs text-npb-text-muted">
          O domínio precisa estar verificado no Resend (Domains → SPF/DKIM
          aplicados no DNS). Enquanto não preencher, os e-mails saem do default
          do Resend (`onboarding@resend.dev`), que só envia pro dono da conta.
        </p>
      </fieldset>

      {/* SUPORTE */}
      <fieldset className="space-y-4 rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <legend className="-ml-2 px-2 text-xs font-semibold uppercase tracking-wide text-npb-gold">
          Suporte
        </legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="support_email" className="text-npb-text">
              E-mail de suporte
            </Label>
            <Input
              id="support_email"
              name="support_email"
              type="email"
              defaultValue={init.supportEmail ?? ""}
              placeholder="suporte@seudominio.com.br"
              className="bg-npb-bg3 border-npb-border text-npb-text"
            />
            <p className="text-[11px] text-npb-text-muted">
              Recebe os pedidos de suporte enviados pelos alunos.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="support_whatsapp" className="text-npb-text">
              WhatsApp de suporte
            </Label>
            <Input
              id="support_whatsapp"
              name="support_whatsapp"
              defaultValue={init.supportWhatsapp ?? ""}
              placeholder="+5548988757616"
              className="bg-npb-bg3 border-npb-border text-npb-text"
            />
            <p className="text-[11px] text-npb-text-muted">
              Só dígitos com DDI (será usado em https://wa.me/...).
            </p>
          </div>
        </div>
      </fieldset>

      {state?.error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state?.ok && (
        <div className="flex items-start gap-2 rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Configurações salvas.</span>
        </div>
      )}

      <div>
        <SubmitButton>Salvar configurações</SubmitButton>
      </div>
    </form>
  );
}
