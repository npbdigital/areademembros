"use client";

import { Calendar, CalendarDays, Lock, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ReleaseType =
  | "immediate"
  | "locked"
  | "days_after_enrollment"
  | "fixed_date";

interface DripFieldsProps {
  value: ReleaseType;
  onChange: (value: ReleaseType) => void;
  defaultDays?: number | null;
  defaultDate?: string | null;
}

const options: Array<{
  value: ReleaseType;
  label: string;
  icon: typeof Zap;
  help: string;
}> = [
  {
    value: "immediate",
    label: "Imediato",
    icon: Zap,
    help: "Liberado assim que o aluno se matricular.",
  },
  {
    value: "locked",
    label: "Bloqueado",
    icon: Lock,
    help: "Bloqueia manualmente (independente de data).",
  },
  {
    value: "days_after_enrollment",
    label: "Após matrícula",
    icon: CalendarDays,
    help: "Libera N dias depois que o aluno entra na turma.",
  },
  {
    value: "fixed_date",
    label: "Data fixa",
    icon: Calendar,
    help: "Libera em uma data específica para todos.",
  },
];

export function DripFields({
  value,
  onChange,
  defaultDays,
  defaultDate,
}: DripFieldsProps) {
  return (
    <div className="space-y-3">
      <Label className="text-npb-text">Liberação do conteúdo</Label>
      <input type="hidden" name="release_type" value={value} />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex flex-col gap-1 rounded-md border p-3 text-left transition-colors",
                active
                  ? "border-npb-gold bg-npb-gold/10"
                  : "border-npb-border bg-npb-bg3 hover:border-npb-gold-dim",
              )}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "h-4 w-4",
                    active ? "text-npb-gold" : "text-npb-text-muted",
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    active ? "text-npb-gold" : "text-npb-text",
                  )}
                >
                  {opt.label}
                </span>
              </div>
              <span className="text-xs text-npb-text-muted">{opt.help}</span>
            </button>
          );
        })}
      </div>

      {value === "days_after_enrollment" && (
        <div className="space-y-1.5">
          <Label htmlFor="release_days" className="text-npb-text">
            Quantos dias após a matrícula?
          </Label>
          <Input
            id="release_days"
            name="release_days"
            type="number"
            min={0}
            defaultValue={defaultDays ?? ""}
            placeholder="Ex: 7"
            required
            className="bg-npb-bg3 border-npb-border text-npb-text"
          />
        </div>
      )}

      {value === "fixed_date" && (
        <div className="space-y-1.5">
          <Label htmlFor="release_date" className="text-npb-text">
            Data de liberação
          </Label>
          <Input
            id="release_date"
            name="release_date"
            type="datetime-local"
            defaultValue={defaultDate ? toLocalDateTime(defaultDate) : ""}
            required
            className="bg-npb-bg3 border-npb-border text-npb-text"
          />
        </div>
      )}
    </div>
  );
}

function toLocalDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
