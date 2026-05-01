import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/format-duration";
import { AddCourseToCohortForm } from "@/components/admin/add-course-to-cohort-form";
import { CohortForm } from "@/components/admin/cohort-form";
import { CommunityToggle } from "@/components/admin/community-toggle";
import { DeleteButton } from "@/components/admin/delete-button";
import { EnrollExistingStudentForm } from "@/components/admin/enroll-existing-student-form";
import {
  addCourseToCohortAction,
  deleteCohortAction,
  enrollExistingStudentAction,
  reactivateEnrollmentAction,
  removeCourseFromCohortAction,
  unenrollStudentAction,
  updateCohortAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function EditCohortPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const cohortId = params.id;

  const { data: cohort } = await supabase
    .schema("membros")
    .from("cohorts")
    .select("id, name, description, default_duration_days, support_prefix")
    .eq("id", cohortId)
    .single();

  if (!cohort) notFound();

  // Cursos atualmente vinculados
  const { data: linkedCourses } = await supabase
    .schema("membros")
    .from("cohort_courses")
    .select("id, course_id, has_community_access, courses(id, title, cover_url, is_published)")
    .eq("cohort_id", cohortId);

  // Todos os cursos (pra dropdown de adicionar)
  const { data: allCourses } = await supabase
    .schema("membros")
    .from("courses")
    .select("id, title, is_published")
    .order("title");

  const linkedIds = new Set(
    (linkedCourses ?? []).map((lc) => lc.course_id),
  );
  const availableCourses = (allCourses ?? []).filter(
    (c) => !linkedIds.has(c.id),
  );

  // Matrículas
  const { data: enrollments } = await supabase
    .schema("membros")
    .from("enrollments")
    .select(
      "id, user_id, enrolled_at, expires_at, is_active, source, users(id, full_name, email, avatar_url)",
    )
    .eq("cohort_id", cohortId)
    .order("enrolled_at", { ascending: false });

  // Alunos disponíveis pra matricular (não estão em enrollments dessa turma)
  const enrolledUserIds = new Set((enrollments ?? []).map((e) => e.user_id));
  const { data: allStudents } = await supabase
    .schema("membros")
    .from("users")
    .select("id, full_name, email")
    .eq("role", "student")
    .order("full_name");
  const availableStudents = (allStudents ?? []).filter(
    (s) => !enrolledUserIds.has(s.id),
  );

  const updateAction = updateCohortAction.bind(null, cohortId);
  const deleteAction = deleteCohortAction.bind(null, cohortId);
  const addCourse = addCourseToCohortAction.bind(null, cohortId);
  const enrollAction = enrollExistingStudentAction.bind(null, cohortId);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/cohorts"
          className="inline-flex items-center gap-1.5 text-sm text-npb-text-muted hover:text-npb-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para turmas
        </Link>
        <DeleteButton
          action={deleteAction}
          confirmMessage={`Excluir a turma "${cohort.name}"? Todas as matrículas serão removidas. Não dá pra desfazer.`}
          label="Excluir turma"
        />
      </div>

      <section>
        <h1 className="mb-1 text-xl font-bold text-npb-text">{cohort.name}</h1>
        <p className="mb-2 text-sm text-npb-text-muted">
          Edite nome, descrição e duração do acesso. Vincule cursos e matricule
          alunos abaixo.
        </p>
        <div className="mb-6 inline-flex items-center gap-1.5 rounded-md bg-npb-bg3 px-3 py-1 text-xs">
          <span className="text-npb-text-muted">Duração do acesso:</span>
          <span className="font-semibold text-npb-gold">
            {formatDuration(cohort.default_duration_days)}
          </span>
        </div>
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
          <CohortForm
            action={updateAction}
            initialValues={cohort}
            submitLabel="Salvar alterações"
            successMessage="Turma atualizada (mudanças não afetam matrículas existentes)."
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-npb-gold" />
          <h2 className="text-lg font-bold text-npb-text">Cursos vinculados</h2>
          <span className="rounded bg-npb-bg3 px-2 py-0.5 text-xs text-npb-text-muted">
            {linkedCourses?.length ?? 0}
          </span>
        </div>

        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-4 space-y-4">
          {/* Adicionar curso */}
          {availableCourses.length > 0 ? (
            <AddCourseToCohortForm
              action={addCourse}
              options={availableCourses}
            />
          ) : (
            <p className="rounded-md border border-dashed border-npb-border bg-npb-bg3 px-3 py-3 text-xs text-npb-text-muted">
              Todos os cursos cadastrados já estão vinculados. Crie mais em{" "}
              <Link
                href="/admin/courses/new"
                className="text-npb-gold hover:text-npb-gold-light"
              >
                /admin/courses/new
              </Link>
              .
            </p>
          )}

          {/* Lista de vinculados */}
          {linkedCourses && linkedCourses.length > 0 ? (
            <ul className="divide-y divide-npb-border">
              {linkedCourses.map((lc) => {
                // courses pode vir como array ou objeto dependendo da config
                const course = Array.isArray(lc.courses)
                  ? lc.courses[0]
                  : lc.courses;
                if (!course) return null;
                const removeAction = removeCourseFromCohortAction.bind(
                  null,
                  lc.id,
                  cohortId,
                );
                return (
                  <li
                    key={lc.id}
                    className="flex items-center gap-3 px-2 py-3"
                  >
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-npb-bg3">
                      {course.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={course.cover_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-npb-text-muted">
                          <BookOpen className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/admin/courses/${course.id}`}
                        className="truncate text-sm font-medium text-npb-text hover:text-npb-gold"
                      >
                        {course.title}
                      </Link>
                      {!course.is_published && (
                        <span className="ml-2 inline-block rounded bg-npb-bg3 px-1.5 py-0.5 text-[10px] text-npb-text-muted">
                          rascunho
                        </span>
                      )}
                    </div>
                    <CommunityToggle
                      cohortCourseId={lc.id}
                      cohortId={cohortId}
                      enabled={Boolean(lc.has_community_access)}
                    />
                    <DeleteButton
                      action={removeAction}
                      confirmMessage={`Desvincular "${course.title}" desta turma?`}
                      variant="icon"
                      label="Desvincular"
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-2 py-6 text-center text-sm text-npb-text-muted">
              Nenhum curso vinculado.
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-npb-gold" />
          <h2 className="text-lg font-bold text-npb-text">Alunos matriculados</h2>
          <span className="rounded bg-npb-bg3 px-2 py-0.5 text-xs text-npb-text-muted">
            {enrollments?.filter((e) => e.is_active).length ?? 0} ativos
          </span>
        </div>

        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-4 space-y-4">
          <div className="space-y-2">
            <p className="text-xs text-npb-text-muted">
              <strong>Já tem o aluno cadastrado?</strong> Selecione abaixo.
              Senão,{" "}
              <Link
                href={`/admin/students/new?cohort=${cohortId}`}
                className="text-npb-gold hover:text-npb-gold-light inline-flex items-center gap-1"
              >
                <UserPlus className="h-3 w-3" />
                criar novo aluno + matricular
              </Link>
              .
            </p>
            <EnrollExistingStudentForm
              action={enrollAction}
              options={availableStudents ?? []}
            />
          </div>

          {enrollments && enrollments.length > 0 ? (
            <ul className="divide-y divide-npb-border">
              {enrollments.map((e) => {
                const userRow = Array.isArray(e.users) ? e.users[0] : e.users;
                if (!userRow) return null;
                const enrolledDate = new Date(e.enrolled_at).toLocaleDateString(
                  "pt-BR",
                );
                const expiresDate = e.expires_at
                  ? new Date(e.expires_at).toLocaleDateString("pt-BR")
                  : null;
                const expired =
                  e.expires_at && new Date(e.expires_at) < new Date();

                return (
                  <li
                    key={e.id}
                    className="flex items-center gap-3 px-2 py-3"
                  >
                    <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-npb-bg3">
                      {userRow.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={userRow.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs font-bold text-npb-gold">
                          {(userRow.full_name ?? userRow.email)[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/admin/students/${userRow.id}`}
                        className="truncate text-sm font-medium text-npb-text hover:text-npb-gold"
                      >
                        {userRow.full_name || userRow.email}
                      </Link>
                      <div className="text-xs text-npb-text-muted">
                        {userRow.email}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        {e.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-400">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-npb-bg3 px-1.5 py-0.5 text-[10px] font-semibold text-npb-text-muted">
                            <XCircle className="h-2.5 w-2.5" /> Inativo
                          </span>
                        )}
                        {e.source !== "manual" && (
                          <span className="rounded bg-npb-bg3 px-1.5 py-0.5 text-[10px] text-npb-text-muted">
                            {e.source}
                          </span>
                        )}
                      </div>
                      <span className="text-npb-text-muted">
                        Desde {enrolledDate}
                        {expiresDate && (
                          <>
                            {" · "}
                            <span className={expired ? "text-red-400" : ""}>
                              {expired ? "Expirou" : "Expira"} em {expiresDate}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                    {e.is_active ? (
                      <DeleteButton
                        action={unenrollStudentAction.bind(null, e.id, cohortId)}
                        confirmMessage={`Desativar matrícula de ${userRow.full_name || userRow.email} nesta turma?`}
                        variant="icon"
                        label="Desativar matrícula"
                      />
                    ) : (
                      <ReactivateButton
                        enrollmentId={e.id}
                        cohortId={cohortId}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-2 py-6 text-center text-sm text-npb-text-muted">
              Nenhum aluno matriculado nessa turma.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function ReactivateButton({
  enrollmentId,
  cohortId,
}: {
  enrollmentId: string;
  cohortId: string;
}) {
  const action = reactivateEnrollmentAction.bind(null, enrollmentId, cohortId);
  return (
    <form action={action}>
      <button
        type="submit"
        title="Reativar matrícula"
        className="inline-flex h-8 items-center gap-1.5 rounded px-2 text-xs text-npb-gold hover:bg-npb-gold/15"
      >
        Reativar
      </button>
    </form>
  );
}
