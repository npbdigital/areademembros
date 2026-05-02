"use client";

import { useFormState } from "react-dom";
import { useEffect } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { AvatarUpload } from "@/components/student/avatar-upload";
import {
  type ActionResult,
  updateProfileAction,
} from "@/app/(student)/profile/actions";

interface Props {
  userId: string;
  initialFullName: string;
  initialEmail: string;
  initialPhone: string;
  initialAvatarUrl: string | null;
  initialEmailNotificationsEnabled?: boolean;
}

export function ProfileForm({
  userId,
  initialFullName,
  initialEmail,
  initialPhone,
  initialAvatarUrl,
  initialEmailNotificationsEnabled = true,
}: Props) {
  const router = useRouter();
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    updateProfileAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const initials = (initialFullName || initialEmail)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="space-y-1.5">
        <Label className="text-npb-text">Foto</Label>
        <AvatarUpload
          name="avatar_url"
          userId={userId}
          defaultValue={initialAvatarUrl}
          fallbackText={initials}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="full_name" className="text-npb-text">
            Nome completo <span className="text-npb-gold">*</span>
          </Label>
          <Input
            id="full_name"
            name="full_name"
            defaultValue={initialFullName}
            required
            className="bg-npb-bg3 border-npb-border text-npb-text"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-npb-text">E-mail</Label>
          <Input
            value={initialEmail}
            readOnly
            disabled
            className="bg-npb-bg2 border-npb-border text-npb-text-muted"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone" className="text-npb-text">
          Telefone
        </Label>
        <Input
          id="phone"
          name="phone"
          defaultValue={initialPhone}
          placeholder="+55 11 99999-9999"
          className="bg-npb-bg3 border-npb-border text-npb-text"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-npb-text">Preferências de notificação</Label>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-npb-border bg-npb-bg3 p-3 transition-colors hover:border-npb-gold-dim">
          <input
            type="checkbox"
            name="email_notifications_enabled"
            defaultChecked={initialEmailNotificationsEnabled}
            className="mt-0.5 h-4 w-4 accent-npb-gold"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-npb-text">
              Receber notificações por e-mail
            </div>
            <div className="text-xs text-npb-text-muted">
              Eventos importantes (resposta no seu post, novo curso publicado,
              conquista). Notificações in-app continuam funcionando
              independente desse toggle.
            </div>
          </div>
        </label>
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
          <span>Perfil atualizado.</span>
        </div>
      )}

      <div>
        <SubmitButton>Salvar</SubmitButton>
      </div>
    </form>
  );
}
