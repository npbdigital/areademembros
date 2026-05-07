"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Play,
  RotateCcw,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface CohortInfo {
  id: string;
  name: string;
  default_duration_days: number | null;
}

interface PreviewRow {
  rowNum: number;
  email: string;
  fullName: string | null;
  cpf: string | null;
  phone: string | null;
  enrolledAtIso: string | null;
  errors: string[];
  warnings: string[];
  existing: boolean;
}

interface PreviewPlan {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  emailsDuplicatedInCsv: number;
  willCreateUser: number;
  willUseExistingUser: number;
  willCreateEnrollment: number;
  willUpdateEnrollment: number;
  willSkipEnrollment: number;
}

interface PreviewResp {
  ok: boolean;
  cohort?: { id: string; name: string; durationDays: number | null };
  plan?: PreviewPlan;
  sample?: PreviewRow[];
  errorRows?: Array<{ rowNum: number; email: string; errors: string[] }>;
  fatalErrors?: string[];
  error?: string;
}

interface RunCounters {
  userCreated: number;
  userExisting: number;
  enrollmentCreated: number;
  enrollmentUpdated: number;
  enrollmentSkipped: number;
  failed: number;
}

interface RunResp {
  ok: boolean;
  total?: number;
  processed?: number;
  nextOffset?: number | null;
  done?: boolean;
  counters?: RunCounters;
  failures?: Array<{ rowNum: number; email: string; reason: string }>;
  error?: string;
}

type Phase = "select" | "preview" | "running" | "done";

export function ImportPanel({ cohorts }: { cohorts: CohortInfo[] }) {
  const [phase, setPhase] = useState<Phase>("select");
  const [cohortId, setCohortId] = useState<string>("");
  const [csvText, setCsvText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [previewing, setPreviewing] = useState(false);
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [runState, setRunState] = useState<{
    total: number;
    processed: number;
    counters: RunCounters;
    failures: Array<{ rowNum: number; email: string; reason: string }>;
  } | null>(null);

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Arquivo precisa ser .csv");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setCsvText(String(e.target?.result ?? ""));
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handlePreview() {
    if (!cohortId) {
      toast.error("Selecione a turma destino.");
      return;
    }
    if (!csvText) {
      toast.error("Suba o arquivo CSV primeiro.");
      return;
    }
    setPreviewing(true);
    try {
      const resp = await fetch("/api/admin/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortId, csv: csvText }),
      });
      const data = (await resp.json()) as PreviewResp;
      if (!data.ok) {
        if (data.fatalErrors?.length) {
          toast.error(data.fatalErrors[0]);
        } else {
          toast.error(data.error ?? "Falha no preview.");
        }
        setPreview(data);
        return;
      }
      setPreview(data);
      setPhase("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleRun() {
    if (!cohortId || !csvText) return;
    setRunning(true);
    setPhase("running");
    setRunState({
      total: preview?.plan?.totalRows ?? 0,
      processed: 0,
      counters: {
        userCreated: 0,
        userExisting: 0,
        enrollmentCreated: 0,
        enrollmentUpdated: 0,
        enrollmentSkipped: 0,
        failed: 0,
      },
      failures: [],
    });

    let offset = 0;
    let total = preview?.plan?.totalRows ?? 0;
    const accCounters: RunCounters = {
      userCreated: 0,
      userExisting: 0,
      enrollmentCreated: 0,
      enrollmentUpdated: 0,
      enrollmentSkipped: 0,
      failed: 0,
    };
    const accFailures: Array<{ rowNum: number; email: string; reason: string }> = [];

    try {
      let done = false;
      while (!done) {
        const resp = await fetch("/api/admin/import/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cohortId, csv: csvText, offset }),
        });
        const data = (await resp.json()) as RunResp;
        if (!data.ok) {
          toast.error(data.error ?? "Falha no chunk.");
          break;
        }
        if (typeof data.total === "number") total = data.total;
        if (data.counters) {
          accCounters.userCreated += data.counters.userCreated;
          accCounters.userExisting += data.counters.userExisting;
          accCounters.enrollmentCreated += data.counters.enrollmentCreated;
          accCounters.enrollmentUpdated += data.counters.enrollmentUpdated;
          accCounters.enrollmentSkipped += data.counters.enrollmentSkipped;
          accCounters.failed += data.counters.failed;
        }
        if (data.failures) accFailures.push(...data.failures);
        const processed = data.processed ?? offset;
        setRunState({
          total,
          processed,
          counters: { ...accCounters },
          failures: [...accFailures],
        });
        if (data.done || data.nextOffset === null) {
          done = true;
        } else {
          offset = data.nextOffset ?? offset;
        }
      }
      toast.success("Importação concluída!");
      setPhase("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    setPhase("select");
    setCohortId("");
    setCsvText("");
    setFileName("");
    setPreview(null);
    setRunState(null);
  }

  // --- Tela 1: select + upload ---
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-npb-border bg-npb-bg2 p-5">
        <h2 className="mb-3 text-sm font-bold text-npb-text">
          1. Selecione a turma e suba o arquivo
        </h2>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-npb-text-muted">
              Turma destino
            </label>
            <select
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              disabled={running}
              className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim disabled:opacity-50"
            >
              <option value="">— Selecione —</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.default_duration_days
                    ? ` · ${c.default_duration_days}d`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-npb-text-muted">
              Arquivo CSV
            </label>
            <label className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-dashed border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text-muted hover:border-npb-gold-dim hover:text-npb-text">
              <Upload className="h-4 w-4" />
              <span className="flex-1 truncate">
                {fileName || "Clique pra escolher o arquivo"}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={running}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          {phase !== "select" && (
            <button
              type="button"
              onClick={reset}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-xs font-semibold text-npb-text-muted hover:border-npb-gold-dim hover:text-npb-gold disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Recomeçar
            </button>
          )}
          {(phase === "select" || phase === "preview") && (
            <button
              type="button"
              onClick={handlePreview}
              disabled={!cohortId || !csvText || previewing || running}
              className="inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-4 py-1.5 text-sm font-bold text-black hover:bg-npb-gold-light disabled:opacity-50"
            >
              {previewing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              {phase === "preview" ? "Refazer análise" : "Analisar arquivo"}
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      {preview?.ok && preview.plan && (
        <PreviewSection
          preview={preview}
          onRun={handleRun}
          running={running}
          phase={phase}
        />
      )}

      {/* Erros fatais (cabeçalho ruim) */}
      {preview && !preview.ok && preview.fatalErrors && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-5">
          <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-bold text-red-400">
            <XCircle className="h-4 w-4" /> Não consegui ler o arquivo
          </h3>
          <ul className="ml-5 list-disc space-y-1 text-xs text-red-300">
            {preview.fatalErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Execução em progresso / final */}
      {runState && (
        <RunSection state={runState} phase={phase} />
      )}
    </div>
  );
}

function PreviewSection({
  preview,
  onRun,
  running,
  phase,
}: {
  preview: PreviewResp;
  onRun: () => void;
  running: boolean;
  phase: Phase;
}) {
  const plan = preview.plan!;
  const cohort = preview.cohort!;
  const hasErrors = plan.invalidRows > 0;

  return (
    <div className="space-y-3 rounded-xl border border-npb-border bg-npb-bg2 p-5">
      <h2 className="text-sm font-bold text-npb-text">
        2. Análise — turma <span className="text-npb-gold">{cohort.name}</span>
        {cohort.durationDays ? ` (vence em ${cohort.durationDays}d a partir de "Criado em")` : ""}
      </h2>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Total no CSV" value={plan.totalRows} />
        <Stat label="Vão criar conta" value={plan.willCreateUser} tone="success" />
        <Stat label="Já existem" value={plan.willUseExistingUser} tone="muted" />
        <Stat label="Linhas com erro" value={plan.invalidRows} tone={hasErrors ? "danger" : "muted"} />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Stat label="Matrículas novas" value={plan.willCreateEnrollment} tone="success" />
        <Stat
          label="Matrículas renovadas"
          value={plan.willUpdateEnrollment}
          tone={plan.willUpdateEnrollment > 0 ? "warning" : "muted"}
        />
        <Stat
          label="Matrículas mantidas"
          value={plan.willSkipEnrollment}
          tone="muted"
          hint="CSV é mais antigo que o registro atual"
        />
      </div>

      {plan.emailsDuplicatedInCsv > 0 && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-2 text-[11px] text-yellow-400">
          ⚠ {plan.emailsDuplicatedInCsv} email(s) repetido(s) no próprio CSV — só o primeiro vai contar.
        </div>
      )}

      {/* Sample */}
      {preview.sample && preview.sample.length > 0 && (
        <details className="rounded-md border border-npb-border bg-npb-bg3/50">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-npb-text-muted hover:text-npb-text">
            Ver primeiras {preview.sample.length} linhas
          </summary>
          <div className="overflow-x-auto border-t border-npb-border">
            <table className="w-full min-w-[640px] text-[11px]">
              <thead className="bg-npb-bg3 text-npb-text-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold">#</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Email</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Nome</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Criado em</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-npb-border">
                {preview.sample.map((r) => (
                  <tr key={r.rowNum}>
                    <td className="px-2 py-1.5 text-npb-text-muted">{r.rowNum}</td>
                    <td className="px-2 py-1.5 font-mono text-npb-text">{r.email || "—"}</td>
                    <td className="px-2 py-1.5 text-npb-text-muted">{r.fullName ?? "—"}</td>
                    <td className="px-2 py-1.5 text-npb-text-muted">
                      {r.enrolledAtIso ? new Date(r.enrolledAtIso).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.errors.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-red-400">
                          <XCircle className="h-2.5 w-2.5" />
                          ERRO
                        </span>
                      ) : r.existing ? (
                        <span className="inline-flex items-center gap-1 rounded bg-npb-bg3 px-1.5 py-0.5 text-[9px] font-semibold text-npb-text-muted">
                          já existe
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          novo
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Erros */}
      {preview.errorRows && preview.errorRows.length > 0 && (
        <details className="rounded-md border border-red-500/30 bg-red-500/5">
          <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-red-400">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {plan.invalidRows} linha(s) com erro — clique pra ver até 50
          </summary>
          <ul className="space-y-1 border-t border-red-500/30 p-3 text-[11px] text-red-300">
            {preview.errorRows.map((r) => (
              <li key={r.rowNum}>
                <strong>linha {r.rowNum}</strong> ({r.email || "sem email"}):
                {" "}{r.errors.join("; ")}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onRun}
          disabled={running || phase === "running" || phase === "done" || plan.validRows === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-4 py-2 text-sm font-bold text-black hover:bg-npb-gold-light disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5" />
          Importar {plan.validRows} aluno{plan.validRows === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}

function RunSection({
  state,
  phase,
}: {
  state: {
    total: number;
    processed: number;
    counters: RunCounters;
    failures: Array<{ rowNum: number; email: string; reason: string }>;
  };
  phase: Phase;
}) {
  const pct = state.total > 0 ? Math.round((state.processed / state.total) * 100) : 0;

  return (
    <div className="space-y-3 rounded-xl border border-npb-border bg-npb-bg2 p-5">
      <h2 className="text-sm font-bold text-npb-text">
        {phase === "done" ? "3. Resultado da importação" : "3. Importando..."}
      </h2>

      {phase !== "done" && (
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-npb-text-muted">
            <span>
              {state.processed} de {state.total} processado{state.total === 1 ? "" : "s"}
            </span>
            <span className="font-bold text-npb-gold">{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-npb-bg3">
            <div
              className="h-full bg-npb-gold transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Contas criadas" value={state.counters.userCreated} tone="success" />
        <Stat label="Contas existentes" value={state.counters.userExisting} tone="muted" />
        <Stat label="Falhas" value={state.counters.failed} tone={state.counters.failed > 0 ? "danger" : "muted"} />
        <Stat label="Matrículas novas" value={state.counters.enrollmentCreated} tone="success" />
        <Stat label="Matrículas renovadas" value={state.counters.enrollmentUpdated} tone="warning" />
        <Stat label="Matrículas mantidas" value={state.counters.enrollmentSkipped} tone="muted" />
      </div>

      {state.failures.length > 0 && (
        <details className="rounded-md border border-red-500/30 bg-red-500/5">
          <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-red-400">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {state.failures.length} falha(s) — clique pra ver
          </summary>
          <ul className="max-h-64 space-y-1 overflow-y-auto border-t border-red-500/30 p-3 text-[11px] text-red-300">
            {state.failures.map((f, i) => (
              <li key={i}>
                <strong>linha {f.rowNum}</strong> ({f.email}): {f.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
  hint,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "danger" | "muted";
  hint?: string;
}) {
  const colors: Record<typeof tone, string> = {
    success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
    warning: "border-yellow-500/30 bg-yellow-500/5 text-yellow-400",
    danger: "border-red-500/30 bg-red-500/5 text-red-400",
    muted: "border-npb-border bg-npb-bg3/40 text-npb-text-muted",
  };
  return (
    <div className={`rounded-md border p-2 ${colors[tone]}`} title={hint}>
      <div className="text-[10px] font-semibold uppercase tracking-wider">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-bold text-npb-text">{value}</div>
    </div>
  );
}
