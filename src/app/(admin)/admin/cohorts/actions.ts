"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type ActionResult<T = unknown> = {
  ok: boolean;
  error?: string;
  data?: T;
};

async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");
  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Sem permissão.");
}

function admin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente no .env.local — preencha antes de criar/editar conteúdo.",
    );
  }
  return createAdminClient().schema("membros");
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableStr(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v === "" ? null : v;
}

function nullableDate(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  if (v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ============================================================
// COHORTS
// ============================================================

export async function createCohortAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertAdmin();
  const name = str(formData, "name");
  if (!name) return { ok: false, error: "Nome é obrigatório." };

  const { data, error } = await admin()
    .from("cohorts")
    .insert({
      name,
      description: nullableStr(formData, "description"),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/cohorts");
  redirect(`/admin/cohorts/${data.id}`);
}

export async function updateCohortAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertAdmin();
  const name = str(formData, "name");
  if (!name) return { ok: false, error: "Nome é obrigatório." };

  const { error } = await admin()
    .from("cohorts")
    .update({
      name,
      description: nullableStr(formData, "description"),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/cohorts");
  revalidatePath(`/admin/cohorts/${id}`);
  return { ok: true };
}

export async function deleteCohortAction(id: string): Promise<void> {
  await assertAdmin();
  const { error } = await admin().from("cohorts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/cohorts");
  redirect("/admin/cohorts");
}

// ============================================================
// COHORT_COURSES (vincular cursos à turma)
// ============================================================

export async function addCourseToCohortAction(
  cohortId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertAdmin();
  const courseId = str(formData, "course_id");
  const hasCommunity = formData.get("has_community_access") === "on";

  if (!courseId) return { ok: false, error: "Selecione um curso." };

  const { error } = await admin().from("cohort_courses").insert({
    cohort_id: cohortId,
    course_id: courseId,
    has_community_access: hasCommunity,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/cohorts/${cohortId}`);
  return { ok: true };
}

export async function removeCourseFromCohortAction(
  id: string,
  cohortId: string,
): Promise<void> {
  await assertAdmin();
  const { error } = await admin().from("cohort_courses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/cohorts/${cohortId}`);
}

export async function toggleCommunityAccessAction(
  id: string,
  cohortId: string,
  newValue: boolean,
): Promise<void> {
  await assertAdmin();
  const { error } = await admin()
    .from("cohort_courses")
    .update({ has_community_access: newValue })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/cohorts/${cohortId}`);
}

// ============================================================
// ENROLLMENTS — matricular aluno em uma turma
// ============================================================

export async function enrollExistingStudentAction(
  cohortId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertAdmin();
  const userId = str(formData, "user_id");
  if (!userId) return { ok: false, error: "Selecione um aluno." };

  const expiresAt = nullableDate(formData, "expires_at");

  // Verifica se já existe matrícula nessa turma
  const { data: existing } = await admin()
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("cohort_id", cohortId)
    .maybeSingle();

  if (existing) {
    // Reativa + atualiza expires_at
    const { error } = await admin()
      .from("enrollments")
      .update({
        is_active: true,
        expires_at: expiresAt,
        source: "manual",
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin().from("enrollments").insert({
      user_id: userId,
      cohort_id: cohortId,
      expires_at: expiresAt,
      source: "manual",
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/cohorts/${cohortId}`);
  return { ok: true };
}

export async function unenrollStudentAction(
  enrollmentId: string,
  cohortId: string,
): Promise<void> {
  await assertAdmin();
  const { error } = await admin()
    .from("enrollments")
    .update({ is_active: false })
    .eq("id", enrollmentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/cohorts/${cohortId}`);
}

export async function reactivateEnrollmentAction(
  enrollmentId: string,
  cohortId: string,
): Promise<void> {
  await assertAdmin();
  const { error } = await admin()
    .from("enrollments")
    .update({ is_active: true })
    .eq("id", enrollmentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/cohorts/${cohortId}`);
}
