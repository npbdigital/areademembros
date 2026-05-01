import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StudentCreateForm } from "@/components/admin/student-create-form";

export const dynamic = "force-dynamic";

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: { cohort?: string };
}) {
  const supabase = createClient();
  const { data: cohorts } = await supabase
    .schema("membros")
    .from("cohorts")
    .select("id, name")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/students"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-npb-text-muted hover:text-npb-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para alunos
      </Link>
      <h1 className="mb-1 text-xl font-bold text-npb-text">Novo aluno</h1>
      <p className="mb-6 text-sm text-npb-text-muted">
        O aluno recebe um e-mail com link pra criar a senha. Se o e-mail não
        sair (Resend ainda não tem domínio próprio configurado), você copia o
        link e envia manualmente.
      </p>

      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <StudentCreateForm
          cohortOptions={cohorts ?? []}
          defaultCohortId={searchParams.cohort}
        />
      </div>
    </div>
  );
}
