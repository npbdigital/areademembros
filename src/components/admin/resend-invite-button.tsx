"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { resendInviteAction } from "@/app/(admin)/admin/students/actions";
import { InviteLinkCard } from "@/components/admin/invite-link-card";

interface ResendInviteButtonProps {
  userId: string;
}

export function ResendInviteButton({ userId }: ResendInviteButtonProps) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    inviteUrl: string;
    emailSent: boolean;
    emailError?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handle() {
    if (pending) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await resendInviteAction(userId);
      if (res.ok && res.data) {
        setResult(res.data);
      } else {
        setError(res.error ?? "Erro desconhecido.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text transition-colors hover:border-npb-gold-dim hover:text-npb-gold disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        {pending ? "Gerando link..." : "Reenviar convite / nova senha"}
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {result && (
        <InviteLinkCard
          inviteUrl={result.inviteUrl}
          emailSent={result.emailSent}
          emailError={result.emailError}
        />
      )}
    </div>
  );
}
