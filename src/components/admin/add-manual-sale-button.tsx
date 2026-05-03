"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  addManualSaleAction,
  searchStudentsAction,
} from "@/app/(admin)/admin/affiliates/actions";

/**
 * Botão pra admin gerar dados de "venda fictícia" pra um aluno fictício.
 * NÃO é venda real — só dispara XP/conquistas/decoração pra inflar o
 * perfil do fictício. Selector limita pra role='ficticio'.
 */
export function AddManualSaleButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<StudentResult | null>(null);
  const [product, setProduct] = useState("");
  const [commissionStr, setCommissionStr] = useState("");
  const [quantityStr, setQuantityStr] = useState("1");

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const res = await searchStudentsAction(trimmed, { onlyFicticio: true });
      setSearching(false);
      if (res.ok && res.data) {
        setResults(res.data);
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open]);

  function reset() {
    setQuery("");
    setResults([]);
    setSelected(null);
    setProduct("");
    setCommissionStr("");
    setQuantityStr("1");
  }

  function handleClose() {
    if (pending) return;
    setOpen(false);
    reset();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) {
      toast.error("Selecione um aluno fictício.");
      return;
    }
    const commission = Number(commissionStr.replace(",", "."));
    if (!Number.isFinite(commission) || commission <= 0) {
      toast.error("Valor de comissão inválido.");
      return;
    }
    const qty = parseInt(quantityStr, 10);
    if (!Number.isFinite(qty) || qty < 1 || qty > 100) {
      toast.error("Quantidade entre 1 e 100.");
      return;
    }
    if (!product.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    startTransition(async () => {
      const res = await addManualSaleAction(
        selected.id,
        product,
        commission,
        qty,
      );
      if (res.ok && res.data) {
        const { created, totalXpAwarded } = res.data;
        toast.success(
          created === 1
            ? `Venda fictícia registrada (+${totalXpAwarded} XP).`
            : `${created} vendas fictícias registradas (+${totalXpAwarded} XP no total).`,
        );
        setOpen(false);
        reset();
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
        title="Gerar venda fictícia pra aluno fictício (só XP/conquistas)"
      >
        <Plus className="h-3.5 w-3.5" />
        Venda manual
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fechar"
            onClick={handleClose}
            className="absolute inset-0 bg-black/60"
          />
          <form
            onSubmit={handleSubmit}
            className="relative z-10 w-full max-w-lg space-y-4 rounded-2xl border border-npb-border bg-npb-bg2 p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-npb-text">
                  Gerar venda fictícia
                </h3>
                <p className="mt-1 text-xs text-npb-text-muted">
                  Para alunos <strong>fictícios</strong> apenas. Não conta como
                  receita — é gamificação: dá XP (R$ × 1 + 10), bumpa nível,
                  desbloqueia conquistas e frame de avatar pra ele aparecer
                  como vendedor pros alunos reais.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={pending}
                aria-label="Fechar"
                className="-mr-1 -mt-1 rounded-md p-1 text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Busca de fictícios */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-npb-text">
                Aluno fictício
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-npb-text-muted" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelected(null);
                  }}
                  placeholder="Nome ou e-mail (mín. 2 caracteres)"
                  className="w-full rounded-md border border-npb-border bg-npb-bg3 py-2 pl-9 pr-9 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-npb-text-muted" />
                )}
              </div>

              {selected && (
                <div className="mt-2 flex items-center gap-3 rounded-md border border-npb-gold/40 bg-npb-gold/5 p-3">
                  <Avatar
                    src={selected.avatarUrl}
                    name={selected.fullName ?? selected.email}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-npb-text">
                      {selected.fullName || "(sem nome)"}
                    </p>
                    <p className="truncate text-xs text-npb-text-muted">
                      {selected.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded p-1 text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text"
                    title="Trocar aluno"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {!selected && results.length > 0 && (
                <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto npb-scrollbar rounded-md border border-npb-border bg-npb-bg3 p-1">
                  {results.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(s)}
                        className="flex w-full items-center gap-3 rounded px-2 py-2 text-left transition hover:bg-npb-bg4"
                      >
                        <Avatar
                          src={s.avatarUrl}
                          name={s.fullName ?? s.email}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-npb-text">
                            {s.fullName || "(sem nome)"}
                          </p>
                          <p className="truncate text-xs text-npb-text-muted">
                            {s.email}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!selected &&
                !searching &&
                query.trim().length >= 2 &&
                results.length === 0 && (
                  <p className="mt-2 rounded-md border border-dashed border-npb-border bg-npb-bg3 p-3 text-center text-xs text-npb-text-muted">
                    Nenhum aluno fictício com &quot;{query.trim()}&quot;.
                  </p>
                )}
            </div>

            {/* Produto */}
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

            {/* Comissão + quantidade lado a lado */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-npb-text">
                  Comissão por venda (R$)
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
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-npb-text">
                  Quantidade
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  step={1}
                  value={quantityStr}
                  onChange={(e) => setQuantityStr(e.target.value)}
                  className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
                />
              </div>
            </div>

            {(() => {
              const c = Number(commissionStr.replace(",", "."));
              const q = parseInt(quantityStr, 10);
              if (
                !Number.isFinite(c) ||
                c <= 0 ||
                !Number.isFinite(q) ||
                q < 1
              ) {
                return null;
              }
              const xpPerSale = Math.floor(c) + 10;
              const totalXp = xpPerSale * q;
              const totalValue = c * q;
              return (
                <p className="rounded-md border border-npb-border/50 bg-npb-bg3/40 px-3 py-2 text-[11px] text-npb-text-muted">
                  Vai gerar <strong className="text-npb-text">{q}</strong>{" "}
                  venda{q > 1 ? "s" : ""} de R$ {c.toFixed(2).replace(".", ",")}{" "}
                  (R$ {totalValue.toFixed(2).replace(".", ",")} no total) ·{" "}
                  <strong className="text-npb-gold">+{totalXp} XP</strong>
                </p>
              );
            })()}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                disabled={pending}
                className="rounded-md px-3 py-1.5 text-xs text-npb-text-muted hover:text-npb-text"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending || !selected}
                className="inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-npb-gold-light disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Gerar
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

interface StudentResult {
  id: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
  hasKiwifyLink: boolean;
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  return (
    <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-npb-bg4">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-npb-gold">
          {(name || "?")[0]?.toUpperCase()}
        </div>
      )}
    </div>
  );
}
