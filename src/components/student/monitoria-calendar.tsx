"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface CalendarSessionItem {
  id: string;
  title: string;
  scheduledAt: string; // ISO
  status: "scheduled" | "live" | "ended" | "cancelled";
}

interface Props {
  sessions: CalendarSessionItem[];
}

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
 * Calendário mensal das monitorias do aluno. Cada célula do dia mostra os
 * títulos das sessões previstas; click → /monitorias/[id]. Navegação
 * mês ant/prox via setas.
 *
 * Datas são exibidas no fuso BRT (mesma convenção do resto da plataforma).
 */
export function MonitoriaCalendar({ sessions }: Props) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

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
    // Ordena cada dia por horário
    m.forEach((arr) =>
      arr.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    );
    return m;
  }, [sessions]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  // Calcula cells: dias do mês atual + padding antes pra começar no domingo
  const firstOfMonth = new Date(year, month, 1);
  const startDay = firstOfMonth.getDay(); // 0=dom
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ date: Date | null }> = [];
  for (let i = 0; i < startDay; i++) cells.push({ date: null });
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month, day) });
  }
  // Padding final pra fechar a última semana (múltiplo de 7)
  while (cells.length % 7 !== 0) cells.push({ date: null });

  const todayKey = brtDayKey(today);

  return (
    <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-4 sm:p-5">
      {/* Header com navegação */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="rounded-md p-1.5 text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-bold text-npb-text sm:text-base">
          {MONTH_NAMES[month]} {year}
        </h3>
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="rounded-md p-1.5 text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Header dias da semana */}
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-npb-text-muted">
        {WEEKDAY_SHORT.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Grid de células */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell.date) {
            return <div key={idx} className="aspect-square sm:aspect-auto sm:min-h-[80px]" />;
          }
          const key = brtDayKey(cell.date);
          const items = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          const isPast = cell.date < new Date(today.getFullYear(), today.getMonth(), today.getDate());

          return (
            <div
              key={idx}
              className={`flex aspect-square flex-col rounded-md border p-1 sm:aspect-auto sm:min-h-[80px] sm:p-1.5 ${
                isToday
                  ? "border-npb-gold/60 bg-npb-gold/5"
                  : items.length > 0
                    ? "border-npb-border bg-npb-bg3/50"
                    : "border-transparent"
              } ${isPast && items.length === 0 ? "opacity-40" : ""}`}
            >
              <div
                className={`text-[10px] font-semibold sm:text-xs ${
                  isToday ? "text-npb-gold" : "text-npb-text-muted"
                }`}
              >
                {cell.date.getDate()}
              </div>
              <div className="mt-0.5 flex-1 space-y-0.5 overflow-hidden">
                {items.slice(0, 3).map((s) => (
                  <Link
                    key={s.id}
                    href={`/monitorias/${s.id}`}
                    className={`block truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight transition sm:text-[10px] ${
                      s.status === "live"
                        ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                        : s.status === "scheduled"
                          ? "bg-npb-gold/20 text-npb-gold hover:bg-npb-gold/30"
                          : "bg-npb-bg4 text-npb-text-muted hover:bg-npb-bg4/70"
                    }`}
                    title={`${s.title} · ${formatTimeBrt(s.scheduledAt)}`}
                  >
                    <span className="hidden sm:inline">
                      {formatTimeBrt(s.scheduledAt)}{" "}
                    </span>
                    {s.title}
                  </Link>
                ))}
                {items.length > 3 && (
                  <div className="text-[9px] text-npb-text-muted">
                    +{items.length - 3}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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
