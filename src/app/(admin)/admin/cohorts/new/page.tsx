import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CohortForm } from "@/components/admin/cohort-form";
import { createCohortAction } from "../actions";

export default function NewCohortPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/cohorts"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-npb-text-muted hover:text-npb-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para turmas
      </Link>
      <h1 className="mb-1 text-xl font-bold text-npb-text">Nova turma</h1>
      <p className="mb-6 text-sm text-npb-text-muted">
        Crie a turma agora. Em seguida você vincula os cursos e matricula
        alunos.
      </p>

      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <CohortForm
          action={createCohortAction}
          submitLabel="Criar turma"
        />
      </div>
    </div>
  );
}
