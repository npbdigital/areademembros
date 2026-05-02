/**
 * Helpers de acesso do aluno: descobrir quais turmas/cursos o usuário enxerga.
 *
 * Modelo:
 *   user → enrollments (uma por turma) → cohort_courses → courses
 *
 * Uma matrícula está ATIVA quando:
 *   - is_active = true
 *   - expires_at é null (vitalícia) OU expires_at > agora
 *
 * **Admin e moderator** têm acesso total: enxergam todos os cursos publicados
 * sem precisar de matrícula. O drip libera tudo (enrolled_at = epoch).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AccessRole = "student" | "moderator" | "admin";

/** Roles que pulam check de matrícula (acessam todos os cursos publicados). */
export function isElevatedRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "moderator";
}

/** Lê a role do user logado em membros.users. Default 'student' se não achar. */
export async function getUserRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccessRole> {
  const { data } = await supabase
    .schema("membros")
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = (data as { role?: string } | null)?.role;
  if (role === "admin" || role === "moderator") return role;
  return "student";
}

/**
 * Devolve os ids dos usuários que NÃO contam pras estatísticas reais.
 * Por padrão exclui admin + moderator + ficticio (usuários de teste).
 * Passe `includeFicticio=true` quando o admin quiser ver tudo.
 */
export async function getNonStudentUserIds(
  supabase: SupabaseClient,
  options: { includeFicticio?: boolean } = {},
): Promise<string[]> {
  const roles = options.includeFicticio
    ? ["admin", "moderator"]
    : ["admin", "moderator", "ficticio"];
  const { data } = await supabase
    .schema("membros")
    .from("users")
    .select("id")
    .in("role", roles);
  return ((data ?? []) as Array<{ id: string }>).map((u) => u.id);
}

export interface ActiveEnrollment {
  id: string;
  cohort_id: string;
  enrolled_at: string;
  expires_at: string | null;
}

/** Devolve as matrículas ativas (não expiradas, is_active=true) do aluno. */
export async function getActiveEnrollments(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActiveEnrollment[]> {
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .schema("membros")
    .from("enrollments")
    .select("id, cohort_id, enrolled_at, expires_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  return (data ?? []) as ActiveEnrollment[];
}

export interface CourseAccess {
  course_id: string;
  cohort_id: string;
  /** enrolled_at da matrícula que dá acesso (mais antiga, p/ drip mais cedo). */
  enrolled_at: string;
  has_community_access: boolean;
  /** True quando o acesso vem de role elevada, não de matrícula real. */
  elevated?: boolean;
}

const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

/**
 * Mapeia cada course_id ao qual o usuário tem acesso, com a `enrolled_at`
 * mais antiga (mais permissiva pro drip "X dias após matrícula").
 *
 * Admin/moderator recebe acesso a todos os cursos publicados com
 * `enrolled_at = epoch` (drip libera tudo) e `has_community_access = true`.
 */
export async function getCourseAccessMap(
  supabase: SupabaseClient,
  userId: string,
  role?: string | null,
): Promise<Map<string, CourseAccess>> {
  const effectiveRole = role ?? (await getUserRole(supabase, userId));

  if (isElevatedRole(effectiveRole)) {
    const map = new Map<string, CourseAccess>();
    const { data: courses } = await supabase
      .schema("membros")
      .from("courses")
      .select("id")
      .eq("is_published", true);
    for (const c of (courses ?? []) as Array<{ id: string }>) {
      map.set(c.id, {
        course_id: c.id,
        cohort_id: "",
        enrolled_at: EPOCH_ISO,
        has_community_access: true,
        elevated: true,
      });
    }
    return map;
  }

  const enrollments = await getActiveEnrollments(supabase, userId);
  const map = new Map<string, CourseAccess>();
  if (enrollments.length === 0) return map;

  const cohortIds = enrollments.map((e) => e.cohort_id);
  const { data: links } = await supabase
    .schema("membros")
    .from("cohort_courses")
    .select("cohort_id, course_id, has_community_access")
    .in("cohort_id", cohortIds);

  const enrollByCohort = new Map(enrollments.map((e) => [e.cohort_id, e]));

  for (const link of links ?? []) {
    const enrollment = enrollByCohort.get(link.cohort_id);
    if (!enrollment) continue;
    const existing = map.get(link.course_id);
    if (!existing || enrollment.enrolled_at < existing.enrolled_at) {
      map.set(link.course_id, {
        course_id: link.course_id,
        cohort_id: link.cohort_id,
        enrolled_at: enrollment.enrolled_at,
        has_community_access:
          existing?.has_community_access || link.has_community_access,
      });
    } else if (link.has_community_access && !existing.has_community_access) {
      map.set(link.course_id, { ...existing, has_community_access: true });
    }
  }

  return map;
}

/** Atalho: o user pode acessar este curso? Retorna o CourseAccess ou null. */
export async function checkCourseAccess(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  role?: string | null,
): Promise<CourseAccess | null> {
  const map = await getCourseAccessMap(supabase, userId, role);
  return map.get(courseId) ?? null;
}
