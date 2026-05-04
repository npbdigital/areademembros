"use client";

import { useState, useTransition } from "react";
import { Loader2, Power, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { setAutoEnrollmentEnabledAction } from "@/app/(admin)/admin/products-mapping/actions";

interface Props {
  enabled: boolean;
  unmappedProductsCount: number;
  unmappedSalesCount: number;
  pendingSalesCount: number;
}

/**
 * Toggle global de "Liberação automática". Quando OFF, o trigger SQL ainda
 * registra todas as vendas em purchase_events MAS o endpoint/cron não
 * cadastra ninguém — admin pode ativar a qualquer momento sem perder dados.
 *
 * Avisa visualmente se há produtos não mapeados antes da ativação (alguns
 * vão cair em 'unmapped' e ficar pendentes até admin mapear).
 */
export function AutoEnrollmentToggle({
  enabled,
  unmappedProductsCount,
  unmappedSalesCount,
  pendingSalesCount,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleToggle() {
    const next = !enabled;

    if (next && unmappedProductsCount > 0 && !confirming) {
      setConfirming(true);
      return;
    }

    startTransition(async () => {
      const res = await setAutoEnrollmentEnabledAction(next);
      if (res.ok) {
        toast.success(
          next
            ? "Liberação automática ATIVADA — vendas novas viram matrículas."
            : "Liberação automática DESATIVADA.",
        );
        setConfirming(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <div
      className={`rounded-2xl border p-5 ${
        enabled
          ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-transparent"
          : "border-npb-border bg-npb-bg2"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Power
              className={`h-5 w-5 ${enabled ? "text-emerald-400" : "text-npb-text-muted"}`}
            />
            <h2 className="text-base font-bold text-npb-text">
              Liberação automática:{" "}
              <span
                className={
                  enabled ? "text-emerald-400" : "text-npb-text-muted"
                }
              >
                {enabled ? "ATIVADA" : "DESATIVADA"}
              </span>
            </h2>
          </div>
          <p className="mt-1.5 text-sm text-npb-text-muted">
            {enabled
              ? "Vendas novas dos produtos mapeados criam matrícula em ~5 segundos. Reembolso/cancelamento desativa o acesso."
              : "Sistema está apenas registrando vendas, sem cadastrar alunos. Quando você ativar, novas compras viram matrícula automaticamente."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md border border-npb-border bg-npb-bg3 px-2 py-1 text-npb-text-muted">
              <strong className="text-npb-text">{pendingSalesCount}</strong>{" "}
              vendas na fila
            </span>
            {unmappedSalesCount > 0 && (
              <span className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-yellow-400">
                <strong>{unmappedSalesCount}</strong> aguardando mapeamento
              </span>
            )}
            {unmappedProductsCount > 0 && (
              <span className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-yellow-400">
                <strong>{unmappedProductsCount}</strong> produto
                {unmappedProductsCount === 1 ? "" : "s"} sem mapeamento
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={pending}
          className={`inline-flex flex-shrink-0 items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
            enabled
              ? "bg-red-500 text-white hover:bg-red-400"
              : "bg-npb-gold text-black hover:bg-npb-gold-light"
          }`}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Power className="h-4 w-4" />
          )}
          {enabled ? "Desativar" : "Ativar agora"}
        </button>
      </div>

      {confirming && !enabled && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400" />
          <div className="flex-1 text-xs">
            <p className="font-bold text-yellow-400">
              Atenção: {unmappedProductsCount} produto
              {unmappedProductsCount === 1 ? "" : "s"} ainda não mapeado
              {unmappedProductsCount === 1 ? "" : "s"}.
            </p>
            <p className="mt-1 text-npb-text-muted">
              Vendas desses produtos vão cair em &quot;aguardando
              mapeamento&quot; e ficar pendentes até você mapear. Vai ativar
              mesmo assim?
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-md px-2 py-1 text-xs text-npb-text-muted hover:text-npb-text"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleToggle}
                disabled={pending}
                className="rounded-md bg-npb-gold px-3 py-1 text-xs font-bold text-black hover:bg-npb-gold-light disabled:opacity-50"
              >
                {pending ? "Ativando…" : "Ativar mesmo assim"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
