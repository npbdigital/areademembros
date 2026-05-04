"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { ArrowLeft, MailCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { migracaoSignInAction, type MigracaoResult } from "../actions";
import { AuthLogo } from "@/components/auth-logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";

export default function MigracaoPage() {
  const [state, formAction] = useFormState<MigracaoResult | null, FormData>(
    migracaoSignInAction,
    null,
  );
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.resetSent) setResetSent(true);
  }, [state]);

  if (resetSent) {
    return (
      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-3">
          <AuthLogo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-npb-text">
              Link enviado pro seu e-mail
            </h1>
            <p className="mt-1 text-sm text-npb-text-muted">
              Em alguns instantes você recebe
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 py-2">
          <MailCheck className="h-12 w-12 text-npb-gold" />
          <p className="text-center text-sm text-npb-text-muted">
            Como atualizamos a área de membros, sua senha antiga pode não estar
            funcionando. Enviamos um link pro seu e-mail pra você definir uma
            nova — confere a caixa de entrada (e a pasta de spam, por
            garantia).
          </p>
        </div>

        <Link
          href="/migracao"
          onClick={() => setResetSent(false)}
          className="mt-6 flex items-center justify-center gap-2 text-xs text-npb-text-muted hover:text-npb-gold transition"
        >
          <ArrowLeft className="h-3 w-3" />
          Tentar entrar novamente
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-8 shadow-2xl">
      <div className="mb-6 flex flex-col items-center gap-3">
        <AuthLogo />
        <div className="text-center">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-npb-gold-dim/40 bg-npb-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-npb-gold">
            <Sparkles className="h-3 w-3" />
            Nova área de membros
          </div>
          <h1 className="text-2xl font-bold text-npb-text">
            Bem-vindo à nova área
          </h1>
          <p className="mt-2 text-sm text-npb-text-muted">
            Atualizamos a plataforma. Use o mesmo e-mail e a senha que você já
            usava — se não funcionar, mandamos um link pra você criar uma nova.
          </p>
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="email"
            className="text-npb-text-muted text-xs uppercase tracking-wider"
          >
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

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="password"
            className="text-npb-text-muted text-xs uppercase tracking-wider"
          >
            Senha
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="h-11 border-npb-border bg-npb-bg3 text-npb-text placeholder:text-npb-text-muted/60 focus-visible:border-npb-gold focus-visible:ring-npb-gold/30"
          />
          <p className="text-[11px] text-npb-text-muted/80">
            Não lembra? Tenta entrar mesmo assim — se a senha estiver errada,
            te mandamos um link de recuperação automaticamente.
          </p>
        </div>

        <SubmitButton pendingLabel="Entrando..." className="mt-2">
          Entrar
        </SubmitButton>
      </form>

      <p className="mt-8 text-center text-[11px] uppercase tracking-widest text-npb-text-muted/70">
        Powered by NPB Digital
      </p>
    </div>
  );
}
