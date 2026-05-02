"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  adminUnlinkAffiliateAction,
  forceVerifyAffiliateAction,
  revealCpfCnpjAction,
  unverifyAffiliateAction,
} from "@/app/(admin)/admin/affiliates/actions";

interface Props {
  linkId: string;
  verified: boolean;
  hasCpfCnpj: boolean;
  cpfCnpjLast4: string | null;
}

export function AffiliateRowActions({
  linkId,
  verified,
  hasCpfCnpj,
  cpfCnpjLast4,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  function handleVerify() {
    startTransition(async () => {
      const res = verified
        ? await unverifyAffiliateAction(linkId)
        : await forceVerifyAffiliateAction(linkId);
      if (res.ok) {
        toast.success(verified ? "Verificação removida." : "Verificado!");
        router.refresh();
      } else toast.error(res.error ?? "Falha.");
    });
  }

  function handleUnlink() {
    if (
      !confirm(
        "Remover esta vinculação? As vendas associadas continuam no banco.",
      )
    )
      return;
    startTransition(async () => {
      const res = await adminUnlinkAffiliateAction(linkId);
      if (res.ok) {
        toast.success("Vinculação removida.");
        router.refresh();
      } else toast.error(res.error ?? "Falha.");
    });
  }

  async function handleReveal() {
    if (revealed) {
      setRevealed(null);
      return;
    }
    setRevealing(true);
    try {
      const res = await revealCpfCnpjAction(linkId);
      if (res.ok && res.data) {
        setRevealed(res.data.cpfCnpj ?? "(sem dado)");
      } else {
        toast.error(res.error ?? "Falha ao decifrar.");
      }
    } finally {
      setRevealing(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {hasCpfCnpj && (
        <button
          type="button"
          onClick={handleReveal}
          disabled={revealing}
          title={revealed ? `Esconder ${revealed}` : `Ver CPF/CNPJ (•••${cpfCnpjLast4})`}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-gold"
        >
          {revealing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : revealed ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
          {revealed ? (
            <span className="font-mono">{revealed}</span>
          ) : (
            <span>•••{cpfCnpjLast4}</span>
          )}
        </button>
      )}
      <button
        type="button"
        onClick={handleVerify}
        disabled={pending}
        title={verified ? "Remover verificação" : "Forçar verificado"}
        className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs ${
          verified
            ? "text-yellow-400 hover:bg-yellow-500/10"
            : "text-green-400 hover:bg-green-500/10"
        }`}
      >
        {verified ? (
          <ShieldOff className="h-3 w-3" />
        ) : (
          <CheckCircle2 className="h-3 w-3" />
        )}
        {verified ? "Desverificar" : "Forçar verificado"}
      </button>
      <button
        type="button"
        onClick={handleUnlink}
        disabled={pending}
        title="Remover vinculação"
        className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-red-400 hover:bg-red-500/10"
      >
        <Trash2 className="h-3 w-3" />
        Desvincular
      </button>
    </div>
  );
}
