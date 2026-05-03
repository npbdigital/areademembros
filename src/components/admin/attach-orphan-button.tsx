"use client";

import { useEffect, useState, useTransition } from "react";
import { BadgeCheck, Loader2, Search, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  attachOrphanByStudentEmailAction,
  searchStudentsAction,
} from "@/app/(admin)/admin/affiliates/actions";

interface Props {
  saleId: string;
  /** E-mail Kiwify pré-preenchido como sugestão. */
  suggestedEmail?: string | null;
}

interface StudentResult {
  id: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
  hasKiwifyLink: boolean;
}

const SEARCH_DEBOUNCE_MS = 300;

export function AttachOrphanButton({ saleId, suggestedEmail }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(suggestedEmail ?? "");
  const [results, setResults] = useState<StudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<StudentResult | null>(null);

  // Debounced search — sempre que query muda, espera 300ms e busca
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const res = await searchStudentsAction(trimmed);
      setSearching(false);
      if (res.ok && res.data) {
        setResults(res.data);
      } else {
        setResults([]);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, open]);

  function handleConfirm() {
    if (!selected) {
      toast.error("Selecione um aluno da lista.");
      return;
    }
    startTransition(async () => {
      const res = await attachOrphanByStudentEmailAction(
        saleId,
        selected.email,
      );
      if (res.ok && res.data) {
        toast.success(
          `Atribuído a ${selected.email} (${res.data.attached} venda${res.data.attached === 1 ? "" : "s"} reprocessada${res.data.attached === 1 ? "" : "s"}).`,
        );
        setOpen(false);
        setSelected(null);
        setQuery("");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  function handleClose() {
    if (pending) return;
    setOpen(false);
    setSelected(null);
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
            onClick={handleClose}
            className="absolute inset-0 bg-black/60"
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-npb-border bg-npb-bg2 shadow-2xl">
            <div className="flex items-center justify-between border-b border-npb-border px-5 py-3">
              <h3 className="text-sm font-bold text-npb-text">
                Atribuir venda órfã
              </h3>
              <button
                type="button"
                onClick={handleClose}
                disabled={pending}
                aria-label="Fechar"
                className="rounded-md p-1 text-npb-text-muted hover:bg-npb-bg3"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 p-5">
              <p className="text-xs text-npb-text-muted">
                Pesquise pelo nome ou e-mail do aluno. Vamos criar uma
                vinculação Kiwify pra ele e reprocessar todas as outras vendas
                órfãs com o mesmo e-mail.
              </p>

              {/* Search input */}
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
                  autoFocus
                  className="w-full rounded-md border border-npb-border bg-npb-bg3 py-2 pl-9 pr-9 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-npb-text-muted" />
                )}
              </div>

              {/* Selected card */}
              {selected && (
                <div className="flex items-center gap-3 rounded-md border border-npb-gold/40 bg-npb-gold/5 p-3">
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

              {/* Results list */}
              {!selected && results.length > 0 && (
                <ul className="max-h-64 space-y-1 overflow-y-auto npb-scrollbar rounded-md border border-npb-border bg-npb-bg3 p-1">
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
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-npb-text">
                              {s.fullName || "(sem nome)"}
                            </p>
                            {s.hasKiwifyLink && (
                              <BadgeCheck
                                className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400"
                                aria-label="Já tem vinculação Kiwify"
                              />
                            )}
                            {s.role === "ficticio" && (
                              <span className="flex-shrink-0 rounded bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-blue-300">
                                Fictício
                              </span>
                            )}
                          </div>
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
                  <p className="rounded-md border border-dashed border-npb-border bg-npb-bg3 p-4 text-center text-xs text-npb-text-muted">
                    Nenhum aluno encontrado com &quot;{query.trim()}&quot;.
                  </p>
                )}
            </div>

            <div className="flex justify-end gap-2 border-t border-npb-border bg-npb-bg3 px-5 py-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={pending}
                className="rounded-md px-3 py-1.5 text-xs text-npb-text-muted hover:text-npb-text"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending || !selected}
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
