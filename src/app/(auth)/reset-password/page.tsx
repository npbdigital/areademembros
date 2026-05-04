"use client";

import { useEffect } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { resetPasswordAction, type ActionResult } from "../actions";
import { AuthLogo } from "@/components/auth-logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";

export default function ResetPasswordPage() {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    resetPasswordAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-8 shadow-2xl">
      <div className="mb-8 flex flex-col items-center gap-3">
        <AuthLogo />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-npb-text">Nova senha</h1>
          <p className="mt-1 text-sm text-npb-text-muted">
            Defina sua nova senha de acesso
          </p>
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password" className="text-npb-text-muted text-xs uppercase tracking-wider">
            Nova senha
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="mínimo 8 caracteres"
            className="h-11 border-npb-border bg-npb-bg3 text-npb-text placeholder:text-npb-text-muted/60 focus-visible:border-npb-gold focus-visible:ring-npb-gold/30"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm" className="text-npb-text-muted text-xs uppercase tracking-wider">
            Confirme a senha
          </Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="repita a senha"
            className="h-11 border-npb-border bg-npb-bg3 text-npb-text placeholder:text-npb-text-muted/60 focus-visible:border-npb-gold focus-visible:ring-npb-gold/30"
          />
        </div>

        <SubmitButton pendingLabel="Salvando..." className="mt-2">
          Salvar nova senha
        </SubmitButton>
      </form>

      <Link
        href="/login"
        className="mt-6 flex items-center justify-center gap-2 text-xs text-npb-text-muted hover:text-npb-gold transition"
      >
        <ArrowLeft className="h-3 w-3" />
        Voltar para o login
      </Link>
    </div>
  );
}
