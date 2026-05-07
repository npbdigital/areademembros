import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { ImportPanel } from "@/components/admin/import-panel";

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  const sb = createAdminClient();

  const { data: cohortsRaw } = await sb
    .schema("membros")
    .from("cohorts")
    .select("id, name, default_duration_days")
    .order("name");

  const cohorts = (cohortsRaw ?? []) as Array<{
    id: string;
    name: string;
    default_duration_days: number | null;
  }>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center gap-1 text-sm text-npb-text-muted hover:text-npb-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <header>
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
          <Upload className="h-3.5 w-3.5" />
          Importação de alunos
        </div>
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          Migrar alunos de outra plataforma
        </h1>
        <p className="mt-2 text-sm text-npb-text-muted">
          Use 1 importação por turma. Sobe o CSV com os alunos dessa turma,
          o sistema cadastra (senha padrão <code className="rounded bg-npb-bg3 px-1.5 py-0.5 font-mono text-[11px]">mudar123</code>),
          cria a matrícula e calcula o vencimento a partir da data de criação
          do CSV. Alunos que já existem mantêm a senha — só ganham a matrícula nova.
        </p>
      </header>

      <ImportPanel cohorts={cohorts} />

      <div className="rounded-xl border border-npb-border bg-npb-bg2/50 p-4 text-xs text-npb-text-muted">
        <h3 className="mb-2 font-bold text-npb-text">Formato esperado do CSV</h3>
        <p className="mb-2">
          Aceita o export padrão da plataforma antiga. Colunas mínimas:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <code className="rounded bg-npb-bg3 px-1 font-mono">Email</code>
            {" "}— obrigatório
          </li>
          <li>
            <code className="rounded bg-npb-bg3 px-1 font-mono">Criado em</code>
            {" "}— obrigatório (formato <code className="font-mono">2026-05-07 10:55:06</code>),
            usado pra calcular vencimento
          </li>
          <li>
            <code className="rounded bg-npb-bg3 px-1 font-mono">Nome completo</code>,
            <code className="ml-1 rounded bg-npb-bg3 px-1 font-mono">CPF/CNPJ</code>,
            <code className="ml-1 rounded bg-npb-bg3 px-1 font-mono">Telefone</code>
            {" "}— opcionais
          </li>
        </ul>
      </div>
    </div>
  );
}
