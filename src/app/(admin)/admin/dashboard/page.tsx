import { LayoutDashboard } from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-npb-gold/10 text-npb-gold">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-npb-text">Painel admin</h1>
          <p className="text-sm text-npb-text-muted">
            Visão geral da plataforma — métricas reais entram na Etapa 6.1.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2 p-10 text-center">
        <p className="text-sm text-npb-text-muted">
          <strong className="text-npb-text">Em construção.</strong> Os cards de
          métricas (alunos ativos, novas matrículas, top aulas) entram quando o
          CRUD de cursos, turmas e relatórios estiver pronto.
        </p>
      </div>
    </div>
  );
}
