"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Edit2, Loader2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  removeProductMappingAction,
  saveProductMappingAction,
} from "@/app/(admin)/admin/products-mapping/actions";

interface DiscoveredProduct {
  product_name: string;
  total_sales: number;
  platforms: string[];
  last_sale_date: string | null;
}

interface MappingRow {
  product_name_pattern: string;
  cohort_id: string | null;
  default_expires_days: number | null;
}

interface CohortInfo {
  id: string;
  name: string;
  default_duration_days: number | null;
}

interface Props {
  product: DiscoveredProduct;
  mapping: MappingRow | null;
  cohorts: CohortInfo[];
  cohortMap: Map<string, CohortInfo>;
}

export function ProductMappingRow({
  product,
  mapping,
  cohorts,
  cohortMap,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(!mapping);
  const [pending, startTransition] = useTransition();
  const [selectedCohortId, setSelectedCohortId] = useState(
    mapping?.cohort_id ?? "",
  );
  const [expiresDaysStr, setExpiresDaysStr] = useState(
    mapping?.default_expires_days ? String(mapping.default_expires_days) : "",
  );

  const isMapped = !!mapping?.cohort_id;
  const linkedCohort = mapping?.cohort_id
    ? cohortMap.get(mapping.cohort_id)
    : null;

  function handleSave() {
    if (!selectedCohortId) {
      toast.error("Selecione uma turma.");
      return;
    }
    const days = expiresDaysStr.trim()
      ? parseInt(expiresDaysStr, 10)
      : null;
    if (days !== null && (!Number.isFinite(days) || days < 0)) {
      toast.error("Dias de acesso inválido.");
      return;
    }
    startTransition(async () => {
      const res = await saveProductMappingAction({
        productName: product.product_name,
        cohortId: selectedCohortId,
        defaultExpiresDays: days,
      });
      if (res.ok) {
        toast.success("Mapeamento salvo.");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  function handleRemove() {
    if (!confirm("Remover o mapeamento desse produto?")) return;
    startTransition(async () => {
      const res = await removeProductMappingAction(product.product_name);
      if (res.ok) {
        toast.success("Mapeamento removido.");
        setEditing(true);
        setSelectedCohortId("");
        setExpiresDaysStr("");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <li
      className={`rounded-xl border p-4 transition ${
        isMapped
          ? "border-npb-border bg-npb-bg2"
          : "border-yellow-500/30 bg-yellow-500/5"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isMapped ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />
            ) : (
              <TriangleAlert className="h-4 w-4 flex-shrink-0 text-yellow-400" />
            )}
            <h3 className="text-base font-bold text-npb-text">
              {capitalize(product.product_name)}
            </h3>
          </div>
          <p className="mt-1 text-xs text-npb-text-muted">
            <strong className="text-npb-text">{product.total_sales}</strong>{" "}
            venda{product.total_sales === 1 ? "" : "s"} aprovada
            {product.total_sales === 1 ? "" : "s"} em 90 dias{" "}
            <span className="px-2">·</span>
            {product.platforms.map((p) => (
              <span
                key={p}
                className="mr-1 rounded bg-npb-bg3 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-npb-text-muted"
              >
                {p}
              </span>
            ))}
            {product.last_sale_date && (
              <>
                <span className="px-2">·</span>
                Última venda: {product.last_sale_date}
              </>
            )}
          </p>
        </div>

        {!editing && isMapped && (
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
              → {linkedCohort?.name ?? "Turma removida"}
              {mapping?.default_expires_days && (
                <span className="ml-1 text-[10px] opacity-70">
                  ({mapping.default_expires_days}d)
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={pending}
              title="Editar mapeamento"
              className="rounded-md border border-npb-border bg-npb-bg3 p-1.5 text-npb-text-muted hover:border-npb-gold-dim hover:text-npb-gold disabled:opacity-50"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={pending}
              title="Remover mapeamento"
              className="rounded-md p-1.5 text-npb-text-muted hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-2 rounded-md border border-npb-border bg-npb-bg3 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-npb-text-muted">
                Liberar nesta turma
              </label>
              <select
                value={selectedCohortId}
                onChange={(e) => {
                  setSelectedCohortId(e.target.value);
                  // Auto-preenche dias com o default da cohort
                  const c = cohortMap.get(e.target.value);
                  if (c?.default_duration_days && !expiresDaysStr) {
                    setExpiresDaysStr(String(c.default_duration_days));
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
                value={expiresDaysStr}
                onChange={(e) => setExpiresDaysStr(e.target.value)}
                placeholder="(default)"
                className="w-full rounded-md border border-npb-border bg-npb-bg2 px-2 py-1.5 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
              />
            </div>
          </div>
          <p className="text-[10px] text-npb-text-muted">
            Vazio = usa o padrão da turma. 0 ou em branco aceita acesso
            vitalício se a turma assim define.
          </p>
          <div className="flex justify-end gap-2">
            {isMapped && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setSelectedCohortId(mapping?.cohort_id ?? "");
                  setExpiresDaysStr(
                    mapping?.default_expires_days
                      ? String(mapping.default_expires_days)
                      : "",
                  );
                }}
                disabled={pending}
                className="rounded-md px-3 py-1.5 text-xs text-npb-text-muted hover:text-npb-text"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={pending || !selectedCohortId}
              className="inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-3 py-1.5 text-xs font-bold text-black hover:bg-npb-gold-light disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : null}
              Salvar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function capitalize(s: string): string {
  return s
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
