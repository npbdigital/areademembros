import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Layers,
  Send,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StudentEditForm } from "@/components/admin/student-edit-form";
import { ResendInviteButton } from "@/components/admin/resend-invite-button";
import { updateStudentAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditStudentPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const userId = params.id;

  const { data: student } = await supabase
    .schema("membros")
    .from("users")
    .select("id, full_name, email, phone, avatar_url, is_active, role, created_at")
    .eq("id", userId)
    .single();

  if (!student) notFound();

  const { data: enrollments } = await supabase
    .schema("membros")
    .from("enrollments")
    .select(
      "id, cohort_id, enrolled_at, expires_at, is_active, source, cohorts(id, name)",
    )
    .eq("user_id", userId)
    .order("enrolled_at", { ascending: false });

  const updateAction = updateStudentAction.bind(null, userId);
  const createdAt = new Date(student.created_at).toLocaleDateString("pt-BR");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/students"
          className="inline-flex items-center gap-1.5 text-sm text-npb-text-muted hover:text-npb-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para alunos
        </Link>
      </div>

      <section className="flex items-center gap-4">
        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-npb-bg3 border-2 border-npb-gold">
          {student.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={student.avatar_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-lg font-bold text-npb-gold">
              {(student.full_name || student.email)[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-xl font-bold text-npb-text">
            {student.full_name || "(sem nome)"}
          </h1>
          <p className="text-sm text-npb-text-muted">{student.email}</p>
          <p className="mt-0.5 text-xs text-npb-text-muted">
            Cadastrado em {createdAt} ·{" "}
            {student.is_active !== false ? (
              <span className="text-green-400">Ativo</span>
            ) : (
              <span className="text-red-400">Bloqueado</span>
            )}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-npb-text">Dados do aluno</h2>
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
          <StudentEditForm action={updateAction} initialValues={student} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Send className="h-5 w-5 text-npb-gold" />
          <h2 className="text-lg font-bold text-npb-text">Acesso</h2>
        </div>
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
          <p className="mb-3 text-sm text-npb-text-muted">
            Use isso pra enviar um novo link caso o aluno tenha perdido o
            convite, esquecido a senha, ou o link tenha expirado.
          </p>
          <ResendInviteButton userId={userId} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Layers className="h-5 w-5 text-npb-gold" />
          <h2 className="text-lg font-bold text-npb-text">Matrículas</h2>
          <span className="rounded bg-npb-bg3 px-2 py-0.5 text-xs text-npb-text-muted">
            {enrollments?.length ?? 0}
          </span>
        </div>

        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-4">
          {enrollments && enrollments.length > 0 ? (
            <ul className="divide-y divide-npb-border">
              {enrollments.map((e) => {
                const cohort = Array.isArray(e.cohorts)
                  ? e.cohorts[0]
                  : e.cohorts;
                if (!cohort) return null;
                const enrolled = new Date(e.enrolled_at).toLocaleDateString(
                  "pt-BR",
                );
                const expires = e.expires_at
                  ? new Date(e.expires_at).toLocaleDateString("pt-BR")
                  : null;
                const expired =
                  e.expires_at && new Date(e.expires_at) < new Date();

                return (
                  <li
                    key={e.id}
                    className="flex items-center gap-3 px-2 py-3"
                  >
                    <Layers className="h-4 w-4 flex-shrink-0 text-npb-text-muted" />
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/admin/cohorts/${cohort.id}`}
                        className="truncate text-sm font-medium text-npb-text hover:text-npb-gold"
                      >
                        {cohort.name}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-npb-text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Desde {enrolled}
                        </span>
                        {expires && (
                          <span className={expired ? "text-red-400" : ""}>
                            {expired ? "Expirou" : "Expira"} em {expires}
                          </span>
                        )}
                        {e.source !== "manual" && (
                          <span className="rounded bg-npb-bg3 px-1.5 py-0.5 text-[10px]">
                            {e.source}
                          </span>
                        )}
                      </div>
                    </div>
                    {e.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-400">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Ativa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-npb-bg3 px-1.5 py-0.5 text-[10px] font-semibold text-npb-text-muted">
                        <XCircle className="h-2.5 w-2.5" /> Inativa
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-2 py-6 text-center text-sm text-npb-text-muted">
              Nenhuma matrícula ainda. Vá em{" "}
              <Link
                href="/admin/cohorts"
                className="text-npb-gold hover:text-npb-gold-light"
              >
                /admin/cohorts
              </Link>{" "}
              e matricule este aluno.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
