"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { forgotPasswordAction, type ActionResult } from "../actions";
import { AuthLogo } from "@/components/auth-logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";

export default function ForgotPasswordPage() {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    forgotPasswordAction,
    null,
  );
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) setSent(true);
  }, [state]);

  return (
    <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-8 shadow-2xl">
      <div className="mb-8 flex flex-col items-center gap-3">
        <AuthLogo />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-npb-text">
            Recuperar senha
          </h1>
          <p className="mt-1 text-sm text-npb-text-muted">
            {sent
              ? "Verifique sua caixa de entrada"
              : "Vamos te enviar um link de recuperação"}
          </p>
        </div>
      </div>

      {sent ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <MailCheck className="h-12 w-12 text-npb-gold" />
          <p className="text-center text-sm text-npb-text-muted">
            Se este e-mail existir na nossa base, em alguns instantes você vai
            receber um link para definir uma nova senha.
          </p>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-npb-text-muted text-xs uppercase tracking-wider">
              E-mail
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="seu@email.com"
              className="h-11 border-npb-border bg-npb-bg3 text-npb-text placeholder:text-npb-text-muted/60 focus-visible:border-npb-gold focus-visible:ring-npb-gold/30"
            />
          </div>

          <SubmitButton pendingLabel="Enviando..." className="mt-2">
            Enviar link de recuperação
          </SubmitButton>
        </form>
      )}

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
