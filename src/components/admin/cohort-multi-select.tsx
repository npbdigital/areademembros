"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CohortOption {
  id: string;
  name: string;
  /** Info auxiliar renderizada menor (ex: nomes dos cursos atrelados). */
  hint?: string;
}

interface Props {
  /** Nome do form field — gera `<input type="hidden" name={name}>` por id. */
  name: string;
  options: CohortOption[];
  /** Valores pré-selecionados (em modo edição). */
  defaultValue?: string[];
  placeholder?: string;
}

/**
 * Multi-select com busca pra turmas. Render:
 *   - Tags dos selecionados em cima (X pra remover)
 *   - Dropdown com input de busca + lista filtrada
 *   - Hidden inputs pra cada selecionado (form serializa direitinho)
 *
 * Filtro: case-insensitive, sem acento, busca em `name` e `hint`.
 * Click-outside fecha o dropdown.
 */
export function CohortMultiSelect({
  name,
  options,
  defaultValue = [],
  placeholder = "Buscar turma…",
}: Props) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Click-outside fecha o dropdown
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Foca o input quando abre
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const selectedOptions = useMemo(
    () =>
      selected
        .map((id) => options.find((o) => o.id === id))
        .filter((o): o is CohortOption => Boolean(o)),
    [selected, options],
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter(
      (o) =>
        normalize(o.name).includes(q) ||
        (o.hint ? normalize(o.hint).includes(q) : false),
    );
  }, [options, query]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function remove(id: string) {
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  return (
    <div ref={wrapperRef} className="relative">
      {/* Tags + botão abrir */}
      <div
        className={cn(
          "flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-md border border-npb-border bg-npb-bg3 px-2 py-1.5 text-sm",
          "cursor-pointer transition focus-within:border-npb-gold-dim",
        )}
        onClick={() => setOpen((v) => !v)}
      >
        {selectedOptions.length === 0 ? (
          <span className="px-1 text-npb-text-muted">
            Clique pra escolher turmas…
          </span>
        ) : (
          selectedOptions.map((opt) => (
            <span
              key={opt.id}
              className="inline-flex items-center gap-1 rounded bg-npb-gold/15 px-2 py-0.5 text-xs font-semibold text-npb-gold"
            >
              {opt.name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(opt.id);
                }}
                aria-label={`Remover ${opt.name}`}
                className="rounded-full p-0.5 hover:bg-npb-gold/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 text-npb-text-muted transition",
            open && "rotate-180",
          )}
        />
      </div>

      {/* Hidden inputs — uma por id selecionado */}
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[280px] overflow-hidden rounded-md border border-npb-border bg-npb-bg3 shadow-lg">
          <div className="flex items-center gap-2 border-b border-npb-border px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-npb-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-sm text-npb-text outline-none placeholder:text-npb-text-muted"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="rounded p-0.5 text-npb-text-muted hover:bg-npb-bg2"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <ul className="max-h-[230px] overflow-y-auto npb-scrollbar py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-npb-text-muted">
                Nenhuma turma encontrada por &quot;{query}&quot;.
              </li>
            ) : (
              filtered.map((opt) => {
                const checked = selected.includes(opt.id);
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => toggle(opt.id)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition",
                        checked
                          ? "bg-npb-gold/10 text-npb-gold"
                          : "text-npb-text hover:bg-npb-bg2",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border",
                          checked
                            ? "border-npb-gold bg-npb-gold text-black"
                            : "border-npb-border",
                        )}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate">{opt.name}</span>
                        {opt.hint && (
                          <span className="block truncate text-[10px] text-npb-text-muted">
                            {opt.hint}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
