"use client";

import { Suspense, useEffect } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { signInAction, type ActionResult } from "../actions";
import { AuthLogo, useAuthLogo } from "@/components/auth-logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const params = useSearchParams();
  const prefilledEmail = params.get("email") ?? "";
  const queryError = params.get("error") ?? null;
  const { loginLogoUrl, platformName } = useAuthLogo();

  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    signInAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  useEffect(() => {
    if (queryError) toast.error(queryError);
  }, [queryError]);

  return (
    <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-8 shadow-2xl">
      <div className="mb-8 flex flex-col items-center gap-3">
        <AuthLogo />
        <div className="text-center">
          {!loginLogoUrl && (
            <h1 className="text-2xl font-bold text-npb-text">{platformName}</h1>
          )}
          <p className="mt-1 text-sm text-npb-text-muted">
            Entre na sua área de membros
          </p>
        </div>
      </div>

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
            defaultValue={prefilledEmail}
            placeholder="seu@email.com"
            className="h-11 border-npb-border bg-npb-bg3 text-npb-text placeholder:text-npb-text-muted/60 focus-visible:border-npb-gold focus-visible:ring-npb-gold/30"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-npb-text-muted text-xs uppercase tracking-wider">
              Senha
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs text-npb-gold hover:text-npb-gold-light transition"
            >
              Esqueci minha senha
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="h-11 border-npb-border bg-npb-bg3 text-npb-text placeholder:text-npb-text-muted/60 focus-visible:border-npb-gold focus-visible:ring-npb-gold/30"
          />
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
