"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { saveProductMappingAction } from "@/app/(admin)/admin/products-mapping/actions";

interface CohortInfo {
  id: string;
  name: string;
  default_duration_days: number | null;
}

interface Props {
  cohorts: CohortInfo[];
}

/**
 * Painel pra mapear manualmente produtos que NÃO aparecem no
 * `transactions_data` (ex: Mentoria M20K, LTA 1.0 antigo). Sem isso,
 * o admin precisaria entrar via SQL no Supabase pra criar o mapping.
 *
 * Reusa `saveProductMappingAction` — a mesma action usada pelos cards
 * auto-descobertos. Aceita qualquer string como product_name.
 */
export function AddManualProductMapping({ cohorts }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [productName, setProductName] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [daysStr, setDaysStr] = useState("");

  function reset() {
    setProductName("");
    setCohortId("");
    setDaysStr("");
  }

  function handleSave() {
    const name = productName.trim();
    if (!name) {
      toast.error("Informe o nome do produto.");
      return;
    }
    if (!cohortId) {
      toast.error("Selecione uma turma.");
      return;
    }
    const days = daysStr.trim() ? parseInt(daysStr, 10) : null;
    if (days !== null && (!Number.isFinite(days) || days < 0)) {
      toast.error("Dias de acesso inválido.");
      return;
    }
    startTransition(async () => {
      const res = await saveProductMappingAction({
        productName: name,
        cohortId,
        defaultExpiresDays: days,
      });
      if (res.ok) {
        toast.success("Produto mapeado.");
        reset();
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha ao salvar.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-xs font-semibold text-npb-text-muted hover:border-npb-gold-dim hover:text-npb-gold"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar produto manualmente
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-npb-gold/30 bg-npb-gold/5 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-npb-text">
            Mapear produto manualmente
          </h3>
          <p className="mt-0.5 text-[11px] text-npb-text-muted">
            Use isso pra produtos que ainda não apareceram em vendas (ex:
            Mentoria M20K, LTA 1.0). O nome deve bater EXATAMENTE com o que
            chega no webhook.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded-md p-1 text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-npb-text-muted">
            Nome do produto (como vem da plataforma)
          </label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="ex: Mentoria M20K"
            className="w-full rounded-md border border-npb-border bg-npb-bg2 px-2 py-1.5 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-npb-text-muted">
              Liberar nesta turma
            </label>
            <select
              value={cohortId}
              onChange={(e) => {
                setCohortId(e.target.value);
                const c = cohorts.find((x) => x.id === e.target.value);
                if (c?.default_duration_days && !daysStr) {
                  setDaysStr(String(c.default_duration_days));
                }
              }}
              className="w-full rounded-md border border-npb-border bg-npb-bg2 px-2 py-1.5 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
            >
              <option value="">— Selecione uma turma —</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.default_duration_days
                    ? ` (${c.default_duration_days}d default)`
                    : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-npb-text-muted">
              Dias de acesso
            </label>
            <input
              type="number"
              min={0}
              value={daysStr}
              onChange={(e) => setDaysStr(e.target.value)}
              placeholder="(default)"
              className="w-full rounded-md border border-npb-border bg-npb-bg2 px-2 py-1.5 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            disabled={pending}
            className="rounded-md px-3 py-1.5 text-xs text-npb-text-muted hover:text-npb-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || !productName.trim() || !cohortId}
            className="inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-3 py-1.5 text-xs font-bold text-black hover:bg-npb-gold-light disabled:opacity-50"
          >
            {pending && <Loader2 className="h-3 w-3 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
