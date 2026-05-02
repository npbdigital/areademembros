"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { addManualSaleAction } from "@/app/(admin)/admin/affiliates/actions";

/**
 * Botão pra admin inserir uma venda manual (popular dados pra fictícios,
 * compensar venda perdida, etc.). Insere com source='manual', dispara XP +
 * conquistas iguais a uma venda Kiwify real.
 */
export function AddManualSaleButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [product, setProduct] = useState("");
  const [commissionStr, setCommissionStr] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const commission = Number(commissionStr.replace(",", "."));
    if (!Number.isFinite(commission) || commission <= 0) {
      toast.error("Valor de comissão inválido.");
      return;
    }
    startTransition(async () => {
      const res = await addManualSaleAction(email, product, commission);
      if (res.ok && res.data) {
        toast.success(
          `Venda criada (+${res.data.xpAwarded} XP pro aluno).`,
        );
        setOpen(false);
        setEmail("");
        setProduct("");
        setCommissionStr("");
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
        className="inline-flex items-center gap-1.5 rounded-md border border-npb-border bg-npb-bg2 px-3 py-1.5 text-xs font-semibold text-npb-text hover:border-npb-gold-dim hover:text-npb-gold"
        title="Inserir venda manual (útil pra fictícios e ajustes)"
      >
        <Plus className="h-3.5 w-3.5" />
        Venda manual
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => !pending && setOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <form
            onSubmit={handleSubmit}
            className="relative z-10 w-full max-w-md space-y-4 rounded-2xl border border-npb-border bg-npb-bg2 p-5 shadow-2xl"
          >
            <div>
              <h3 className="text-sm font-bold text-npb-text">
                Inserir venda manual
              </h3>
              <p className="mt-1 text-xs text-npb-text-muted">
                Útil pra popular dados de fictícios ou registrar venda que não
                chegou pelo webhook. Vai dar XP igual venda Kiwify
                (R$ × 1 + 10) e bumpar pro Nível II se for a 1ª venda paga.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-npb-text">
                E-mail do aluno
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aluno@email.com"
                className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-npb-text">
                Produto
              </label>
              <input
                type="text"
                required
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="Ex: Batatas Lucrativas"
                className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-npb-text">
                Comissão (R$)
              </label>
              <input
                type="text"
                required
                inputMode="decimal"
                value={commissionStr}
                onChange={(e) => setCommissionStr(e.target.value)}
                placeholder="21,65"
                className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md px-3 py-1.5 text-xs text-npb-text-muted hover:text-npb-text"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-3 py-1.5 text-xs font-semibold text-black hover:bg-npb-gold-light disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Criar venda
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
