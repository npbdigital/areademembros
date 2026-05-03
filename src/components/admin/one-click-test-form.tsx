"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { generateTestOneClickAction } from "@/app/(admin)/admin/one-click-test/actions";

interface ResultState {
  url: string;
  expiresAt: string;
  email: string;
  fullName: string;
  isNewUser: boolean;
}

export function OneClickTestForm() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [forceOnboarding, setForceOnboarding] = useState(true);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ResultState | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return toast.error("E-mail é obrigatório.");

    startTransition(async () => {
      const res = await generateTestOneClickAction({
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        forceOnboarding,
      });
      if (res.ok && res.data) {
        setResult(res.data);
        toast.success("Link gerado!");
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Falha ao copiar.");
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-npb-border bg-npb-bg2 p-6"
      >
        <div>
          <label className="mb-1 block text-xs font-semibold text-npb-text-muted">
            E-mail do aluno <span className="text-npb-gold">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="aluno@exemplo.com"
            className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-npb-text-muted">
            Nome (opcional — só pra users novos)
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="João Silva"
            className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-npb-border bg-npb-bg3 p-3 text-sm text-npb-text">
          <input
            type="checkbox"
            checked={forceOnboarding}
            onChange={(e) => setForceOnboarding(e.target.checked)}
            className="h-4 w-4 accent-npb-gold"
          />
          <span>
            Forçar tela de onboarding (criar senha + foto após login)
          </span>
        </label>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-4 py-2 text-sm font-bold text-black hover:bg-npb-gold-light disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Gerar link de teste
            </>
          )}
        </button>
      </form>

      {result && (
        <div className="space-y-3 rounded-2xl border border-green-500/40 bg-green-500/5 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-green-400">
              Link gerado
            </p>
            <p className="mt-1 text-xs text-npb-text-muted">
              {result.isNewUser ? (
                <>
                  ✅ User novo criado (<code>{result.email}</code>) com role{" "}
                  <strong>fictício</strong>. Clique no link pra logar como ele
                  e testar o onboarding.
                </>
              ) : (
                <>
                  ⚠️ E-mail <code>{result.email}</code> já existia — gerei
                  token sem mexer no profile.
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border border-npb-border bg-npb-bg2 px-3 py-2 text-xs text-npb-text">
              {result.url}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-xs font-semibold text-npb-text hover:border-npb-gold"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-400" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </>
              )}
            </button>
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-npb-gold px-3 py-2 text-xs font-bold text-black hover:bg-npb-gold-light"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir
            </a>
          </div>

          <p className="text-[11px] text-npb-text-muted">
            Expira em{" "}
            <strong>
              {new Date(result.expiresAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
            </strong>
            . Reutilizável até essa data.
          </p>
        </div>
      )}
    </div>
  );
}
