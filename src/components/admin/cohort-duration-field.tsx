"use client";

import { useState } from "react";
import { Calendar, Edit3, Infinity as InfinityIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CohortDurationFieldProps {
  defaultValue?: number | null;
  name?: string;
}

const PRESETS: Array<{ label: string; days: number | null }> = [
  { label: "Vitalício", days: null },
  { label: "30 dias", days: 30 },
  { label: "3 meses", days: 90 },
  { label: "6 meses", days: 180 },
  { label: "1 ano", days: 365 },
];

/**
 * Pickers visuais (vitalício / 1 mês / 3 meses / 6 meses / 1 ano) +
 * opção "Personalizado" que abre input numérico.
 *
 * Serializa via <input type="hidden" name={name}> com valor "" pra
 * vitalício e número pros outros.
 */
export function CohortDurationField({
  defaultValue,
  name = "default_duration_days",
}: CohortDurationFieldProps) {
  // Determina se o valor inicial é um preset ou custom
  const isPreset =
    defaultValue === null ||
    defaultValue === undefined ||
    PRESETS.some((p) => p.days === defaultValue);

  const [days, setDays] = useState<number | null>(defaultValue ?? null);
  const [custom, setCustom] = useState(!isPreset);
  const [customValue, setCustomValue] = useState<number>(
    !isPreset && typeof defaultValue === "number" ? defaultValue : 60,
  );

  function pickPreset(p: { days: number | null }) {
    setCustom(false);
    setDays(p.days);
  }

  function pickCustom() {
    setCustom(true);
    setDays(customValue);
  }

  function updateCustomValue(v: number) {
    setCustomValue(v);
    if (custom) setDays(v);
  }

  return (
    <div className="space-y-3">
      <Label className="text-npb-text">Duração do acesso</Label>
      <input type="hidden" name={name} value={days === null ? "" : days} />

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const active = !custom && days === p.days;
          const Icon = p.days === null ? InfinityIcon : Calendar;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => pickPreset(p)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-npb-gold bg-npb-gold/15 text-npb-gold"
                  : "border-npb-border bg-npb-bg3 text-npb-text-muted hover:border-npb-gold-dim hover:text-npb-text",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={pickCustom}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
            custom
              ? "border-npb-gold bg-npb-gold/15 text-npb-gold"
              : "border-npb-border bg-npb-bg3 text-npb-text-muted hover:border-npb-gold-dim hover:text-npb-text",
          )}
        >
          <Edit3 className="h-3.5 w-3.5" />
          Personalizado
        </button>
      </div>

      {custom && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={customValue}
            onChange={(e) =>
              updateCustomValue(Math.max(1, Number(e.target.value) || 1))
            }
            className="w-32 bg-npb-bg3 border-npb-border text-npb-text"
          />
          <span className="text-sm text-npb-text-muted">dias</span>
        </div>
      )}

      <p className="text-xs text-npb-text-muted">
        {days === null
          ? "Sem expiração — alunos matriculados nessa turma têm acesso pra sempre."
          : `Cada aluno matriculado terá acesso por ${days} dias a partir da data da matrícula.`}
      </p>
    </div>
  );
}
