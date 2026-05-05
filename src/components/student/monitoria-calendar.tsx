"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

export interface CalendarSessionItem {
  id: string;
  title: string;
  scheduledAt: string; // ISO
  status: "scheduled" | "live" | "ended" | "cancelled";
}

interface Props {
  sessions: CalendarSessionItem[];
}

const WEEKDAY_FULL = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/**
 * Calendário SEMANAL das monitorias do aluno. Como as monitorias se
 * repetem semanalmente, mostrar mês inteiro polui — vista de 7 dias
 * dá muito mais espaço pro título e horário, e a navegação fica
 * direta (semana anterior / próxima).
 *
 * Cada coluna do dia mostra os títulos das sessões previstas; click
 * → /monitorias/[id]. Datas são exibidas no fuso BRT.
 */
export function MonitoriaCalendar({ sessions }: Props) {
  const today = useMemo(() => new Date(), []);

  // Cursor aponta pro DOMINGO da semana atual. Navega em incrementos de 7d.
  const [cursor, setCursor] = useState(() => startOfWeekSunday(today));

  // Agrupa sessões por chave YYYY-MM-DD (BRT)
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarSessionItem[]>();
    for (const s of sessions) {
      const d = new Date(s.scheduledAt);
      const key = brtDayKey(d);
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    m.forEach((arr) =>
      arr.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    );
    return m;
  }, [sessions]);

  // Os 7 dias da semana corrente (Dom → Sáb)
  const weekDays = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(cursor);
      d.setDate(d.getDate() + i);
      out.push(d);
    }
    return out;
  }, [cursor]);

  const todayKey = brtDayKey(today);

  function navigate(delta: number) {
    const next = new Date(cursor);
    next.setDate(next.getDate() + delta * 7);
    setCursor(next);
  }

  function goToToday() {
    setCursor(startOfWeekSunday(today));
  }

  const firstDay = weekDays[0];
  const lastDay = weekDays[6];
  const isCurrentWeek = brtDayKey(firstDay) === brtDayKey(startOfWeekSunday(today));

  return (
    <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-4 sm:p-5">
      {/* Header com navegação semanal */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md p-1.5 text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="rounded-md p-1.5 text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text"
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={goToToday}
              className="ml-1 rounded-md border border-npb-border bg-npb-bg3 px-2 py-1 text-[11px] font-semibold text-npb-text-muted hover:border-npb-gold-dim hover:text-npb-gold"
            >
              Hoje
            </button>
          )}
        </div>
        <h3 className="text-sm font-bold text-npb-text sm:text-base">
          {formatRangeLabel(firstDay, lastDay)}
        </h3>
      </div>

      {/* Grid 7 dias — em mobile cai pra 1 coluna empilhada */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7 sm:gap-1.5">
        {weekDays.map((date, idx) => {
          const key = brtDayKey(date);
          const items = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          const isPast =
            date <
            new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const dayOfWeek = date.getDay();

          return (
            <div
              key={idx}
              className={`flex flex-col rounded-md border p-2 sm:min-h-[140px] ${
                isToday
                  ? "border-npb-gold/60 bg-npb-gold/5"
                  : items.length > 0
                    ? "border-npb-border bg-npb-bg3/50"
                    : "border-npb-border/40 bg-transparent"
              } ${isPast && items.length === 0 ? "opacity-50" : ""}`}
            >
              <div
                className={`flex items-baseline justify-between border-b border-npb-border/30 pb-1.5 ${
                  isToday ? "text-npb-gold" : "text-npb-text-muted"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  <span className="sm:hidden">{WEEKDAY_FULL[dayOfWeek]}</span>
                  <span className="hidden sm:inline">
                    {WEEKDAY_SHORT[dayOfWeek]}
                  </span>
                </span>
                <span
                  className={`text-base font-bold sm:text-sm ${isToday ? "text-npb-gold" : "text-npb-text"}`}
                >
                  {date.getDate()}
                </span>
              </div>
              <div className="mt-2 flex-1 space-y-1.5">
                {items.length === 0 ? (
                  <div className="text-[10px] italic text-npb-text-muted/60">
                    sem monitoria
                  </div>
                ) : (
                  items.map((s) => (
                    <Link
                      key={s.id}
                      href={`/monitorias/${s.id}`}
                      className={`block rounded px-1.5 py-1 text-[11px] font-medium leading-tight transition ${
                        s.status === "live"
                          ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                          : s.status === "scheduled"
                            ? "bg-npb-gold/20 text-npb-gold hover:bg-npb-gold/30"
                            : "bg-npb-bg4 text-npb-text-muted hover:bg-npb-bg4/70"
                      }`}
                      title={`${s.title} · ${formatTimeBrt(s.scheduledAt)}`}
                    >
                      <div className="flex items-center gap-1 text-[10px] opacity-80">
                        <Clock className="h-2.5 w-2.5" />
                        {formatTimeBrt(s.scheduledAt)}
                      </div>
                      <div className="line-clamp-2">{s.title}</div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Domingo da semana que contem a data informada (00:00 local). */
function startOfWeekSunday(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - out.getDay());
  return out;
}

/**
 * Chave YYYY-MM-DD baseada no fuso BRT (UTC-3). Não usa toISOString
 * porque ela é UTC e quebraria quando uma sessão de 22h BRT cai no dia
 * seguinte UTC.
 */
function brtDayKey(d: Date): string {
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const y = brt.getUTCFullYear();
  const m = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(brt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTimeBrt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Label do range da semana. Compacta quando o mês é o mesmo:
 *   "4–10 Maio 2026"
 * Cross-month:
 *   "27 Abr – 3 Mai 2026"
 * Cross-year (raro):
 *   "30 Dez 2025 – 5 Jan 2026"
 */
function formatRangeLabel(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
  }
  if (sameYear) {
    const monthShort = (m: number) => MONTH_NAMES[m].slice(0, 3);
    return `${start.getDate()} ${monthShort(start.getMonth())} – ${end.getDate()} ${monthShort(end.getMonth())} ${start.getFullYear()}`;
  }
  const monthShort = (m: number) => MONTH_NAMES[m].slice(0, 3);
  return `${start.getDate()} ${monthShort(start.getMonth())} ${start.getFullYear()} – ${end.getDate()} ${monthShort(end.getMonth())} ${end.getFullYear()}`;
}
