"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Filter, Search, X } from "lucide-react";

interface CohortOption {
  id: string;
  name: string;
}

interface Defaults {
  q: string;
  cohort: string;
  from: string;
  to: string;
  access: string;
  showFicticio: boolean;
}

interface Props {
  defaults: Defaults;
  cohorts: CohortOption[];
}

const ACCESS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Qualquer momento" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "never", label: "Nunca acessou" },
];

/**
 * Form GET de filtros — re-renderiza a página via navegação. Sem JS,
 * o "Aplicar" funciona como submit comum. O hidden showFicticio mantém
 * o toggle da página ao aplicar filtros.
 */
export function StudentsFilters({ defaults, cohorts }: Props) {
  // Mantém o input controlado pra "Limpar" funcionar sem reload.
  const [q, setQ] = useState(defaults.q);
  const [cohort, setCohort] = useState(defaults.cohort);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [access, setAccess] = useState(defaults.access);

  // Re-sincroniza quando os defaults mudam (ex: usuário clicou "Limpar")
  useEffect(() => {
    setQ(defaults.q);
    setCohort(defaults.cohort);
    setFrom(defaults.from);
    setTo(defaults.to);
    setAccess(defaults.access);
  }, [defaults.q, defaults.cohort, defaults.from, defaults.to, defaults.access]);

  const hasAnyFilter =
    !!defaults.q ||
    !!defaults.cohort ||
    !!defaults.from ||
    !!defaults.to ||
    !!defaults.access;

  const clearHref = defaults.showFicticio
    ? "/admin/students"
    : "/admin/students?showFicticio=0";

  return (
    <form
      action="/admin/students"
      method="get"
      className="rounded-xl border border-npb-border bg-npb-bg2 p-3"
    >
      {/* Mantem o toggle de ficticios ao aplicar filtros */}
      {!defaults.showFicticio && (
        <input type="hidden" name="showFicticio" value="0" />
      )}

      <div className="flex flex-wrap items-end gap-2">
        {/* Busca */}
        <div className="flex flex-1 flex-col gap-1 min-w-[200px]">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-npb-text-muted">
            Buscar nome ou email
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-npb-text-muted" />
            <input
              type="text"
              name="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ex: maria@gmail.com"
              className="w-full rounded-md border border-npb-border bg-npb-bg3 pl-7 pr-2 py-1.5 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
            />
          </div>
        </div>

        {/* Turma */}
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-npb-text-muted">
            Turma
          </label>
          <select
            name="cohort"
            value={cohort}
            onChange={(e) => setCohort(e.target.value)}
            className="rounded-md border border-npb-border bg-npb-bg3 px-2 py-1.5 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
          >
            <option value="">Todas as turmas</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Último acesso */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-npb-text-muted">
            Último acesso
          </label>
          <select
            name="access"
            value={access}
            onChange={(e) => setAccess(e.target.value)}
            className="rounded-md border border-npb-border bg-npb-bg3 px-2 py-1.5 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
          >
            {ACCESS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Criado em */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-npb-text-muted">
            Criado de
          </label>
          <input
            type="date"
            name="from"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-npb-border bg-npb-bg3 px-2 py-1.5 text-sm text-npb-text outline-none focus:border-npb-gold-dim [color-scheme:dark]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-npb-text-muted">
            até
          </label>
          <input
            type="date"
            name="to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-npb-border bg-npb-bg3 px-2 py-1.5 text-sm text-npb-text outline-none focus:border-npb-gold-dim [color-scheme:dark]"
          />
        </div>

        {/* Botões */}
        <div className="flex items-end gap-1 pt-3">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-3 py-1.5 text-sm font-bold text-black hover:bg-npb-gold-light"
          >
            <Filter className="h-3.5 w-3.5" />
            Aplicar
          </button>
          {hasAnyFilter && (
            <Link
              href={clearHref}
              className="inline-flex items-center gap-1.5 rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-sm font-semibold text-npb-text-muted hover:border-npb-gold-dim hover:text-npb-gold"
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}
