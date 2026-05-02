"use client";

import { useState, useTransition } from "react";
import { Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { attachOrphanByStudentEmailAction } from "@/app/(admin)/admin/affiliates/actions";

interface Props {
  saleId: string;
  /** E-mail Kiwify pré-preenchido como sugestão (na maioria dos casos é o
   * mesmo do aluno na plataforma). */
  suggestedEmail?: string | null;
}

export function AttachOrphanButton({ saleId, suggestedEmail }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(suggestedEmail ?? "");

  function handleConfirm() {
    if (!email.trim()) {
      toast.error("Preencha o e-mail do aluno.");
      return;
    }
    startTransition(async () => {
      const res = await attachOrphanByStudentEmailAction(saleId, email);
      if (res.ok && res.data) {
        toast.success(
          `Atribuído a ${email} (${res.data.attached} venda${res.data.attached === 1 ? "" : "s"} reprocessada${res.data.attached === 1 ? "" : "s"}).`,
        );
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Atribuir manualmente a um aluno"
        className="inline-flex items-center gap-1 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-1.5 py-1 text-[10px] font-semibold text-yellow-400 transition hover:bg-yellow-500/20"
      >
        <UserCheck className="h-3 w-3" />
        Atribuir
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => !pending && setOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-npb-border bg-npb-bg2 p-5 shadow-2xl">
            <h3 className="mb-1 text-sm font-bold text-npb-text">
              Atribuir venda órfã
            </h3>
            <p className="mb-4 text-xs text-npb-text-muted">
              Digite o e-mail do aluno (o do cadastro na plataforma). Vamos
              criar uma vinculação Kiwify pra ele e reprocessar todas as outras
              vendas órfãs com o mesmo e-mail Kiwify.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aluno@email.com"
              autoFocus
              className="mb-4 w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md px-3 py-1.5 text-xs text-npb-text-muted hover:text-npb-text"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-npb-gold-light disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserCheck className="h-3.5 w-3.5" />
                )}
                Atribuir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
