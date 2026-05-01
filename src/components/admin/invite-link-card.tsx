"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, Mail, MailWarning } from "lucide-react";

interface InviteLinkCardProps {
  inviteUrl: string;
  emailSent: boolean;
  emailError?: string;
  recipient?: string;
}

export function InviteLinkCard({
  inviteUrl,
  emailSent,
  emailError,
  recipient,
}: InviteLinkCardProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link manualmente:", inviteUrl);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-npb-gold-dim/40 bg-npb-gold/5 p-4">
      {emailSent ? (
        <div className="flex items-start gap-2 text-sm text-green-400">
          <Mail className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            E-mail enviado{recipient ? ` para ${recipient}` : ""}. O aluno
            recebe o link de criação de senha.
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-2 text-sm text-yellow-400">
          <MailWarning className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <div className="font-medium">E-mail não enviado.</div>
            {emailError && (
              <div className="mt-0.5 text-xs text-yellow-400/80">
                {emailError}
              </div>
            )}
            <div className="mt-1 text-xs text-npb-text-muted">
              Copie o link abaixo e envie pro aluno (WhatsApp, e-mail próprio,
              etc.).
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="text-xs font-medium uppercase tracking-wider text-npb-text-muted">
          Link de convite (válido por 1 hora)
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={inviteUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="flex-1 rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 font-mono text-xs text-npb-text outline-none"
          />
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-npb-gold-light"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-npb-text-muted">
        <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
        <span>
          Esse link expira em ~1 hora. Se passar do prazo, gere outro pelo botão
          &quot;Reenviar convite&quot; na página do aluno.
        </span>
      </div>
    </div>
  );
}
