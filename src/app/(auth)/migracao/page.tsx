"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { ArrowLeft, KeyRound, MailCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { migracaoSignInAction, type MigracaoResult } from "../actions";
import { AuthLogo } from "@/components/auth-logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";

const TUTORIAL_VIDEO_ID = "Gk6Yku9TizM";

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
      <div className="mx-auto w-full max-w-md rounded-2xl border border-npb-border bg-npb-bg2 p-8 shadow-2xl">
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
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Cabecalho com logo + selo "nova area" */}
      <div className="flex flex-col items-center gap-3 text-center">
        <AuthLogo />
        <div className="inline-flex items-center gap-1.5 rounded-full border border-npb-gold-dim/40 bg-npb-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-npb-gold">
          <Sparkles className="h-3 w-3" />
          Nova área de membros
        </div>
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          Bem-vindo à nova plataforma!
        </h1>
        <p className="max-w-xl text-sm text-npb-text-muted">
          Atualizamos a área de membros pra você ter uma experiência muito
          melhor. Assista o vídeo abaixo pra um tour rápido e use os passos
          ao lado pra entrar.
        </p>
      </div>

      {/* Grid: video em cima (mobile) | video + form lado-a-lado (desktop) */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-5">
        {/* Video */}
        <div className="md:col-span-3">
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-npb-border bg-black shadow-2xl">
            <iframe
              src={`https://www.youtube.com/embed/${TUTORIAL_VIDEO_ID}?rel=0`}
              title="Tour da nova área de membros"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>

          {/* Instrucoes embaixo do video */}
          <div className="mt-4 rounded-xl border border-npb-gold/30 bg-npb-gold/5 p-4">
            <h2 className="mb-2 inline-flex items-center gap-2 text-sm font-bold text-npb-gold">
              <KeyRound className="h-4 w-4" />
              Como entrar pela primeira vez
            </h2>
            <ol className="space-y-2 text-sm text-npb-text">
              <li>
                <strong className="text-npb-gold">1.</strong> Use o{" "}
                <strong>mesmo e-mail</strong> que você sempre usou na
                plataforma antiga.
              </li>
              <li>
                <strong className="text-npb-gold">2.</strong> Sua senha
                continua sendo{" "}
                <code className="rounded bg-npb-bg3 px-1.5 py-0.5 font-mono text-[12px] text-npb-gold">
                  mudar123
                </code>{" "}
                — a mesma da plataforma antiga.
              </li>
              <li>
                <strong className="text-npb-gold">3.</strong> Se a senha não
                funcionar (você trocou em algum momento), a gente envia um
                link de recuperação pro seu e-mail automaticamente.
              </li>
              <li>
                <strong className="text-npb-gold">4.</strong> Depois de
                entrar, recomendamos trocar a senha em{" "}
                <em>Perfil → Trocar senha</em>.
              </li>
            </ol>
          </div>
        </div>

        {/* Form de login */}
        <div className="md:col-span-2">
          <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6 shadow-2xl md:sticky md:top-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-npb-text">
                Entrar agora
              </h2>
              <p className="mt-1 text-xs text-npb-text-muted">
                Use seu e-mail + senha{" "}
                <code className="rounded bg-npb-bg3 px-1 font-mono text-[10px]">
                  mudar123
                </code>
              </p>
            </div>

            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="email"
                  className="text-npb-text-muted text-[10px] uppercase tracking-wider"
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

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="password"
                  className="text-npb-text-muted text-[10px] uppercase tracking-wider"
                >
                  Senha
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="mudar123"
                  className="h-11 border-npb-border bg-npb-bg3 text-npb-text placeholder:text-npb-text-muted/60 focus-visible:border-npb-gold focus-visible:ring-npb-gold/30"
                />
                <p className="text-[10px] leading-relaxed text-npb-text-muted/80">
                  Não funcionou? Tenta mesmo assim — se a senha estiver errada
                  te mandamos um link de recuperação automaticamente.
                </p>
              </div>

              <SubmitButton pendingLabel="Entrando..." className="mt-1">
                Entrar
              </SubmitButton>
            </form>

            <p className="mt-6 text-center text-[10px] uppercase tracking-widest text-npb-text-muted/70">
              Powered by NPB Digital
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
