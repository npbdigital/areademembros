import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { notifyAndEmail } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron drip — roda 1x por dia (configurado em vercel.json).
 *
 * Pra cada matrícula ativa, calcula `dias_desde_matricula`. Pra cada lição
 * publicada com `release_type='days_after_enrollment'` E `release_days =
 * dias_desde_matricula`, notifica o aluno que aquela aula liberou hoje.
 *
 * Idempotência: cada notif tem `link=/lessons/{id}` único por user. Antes
 * de inserir, checa se já existe notif com mesmo user_id+link nas últimas
 * 48h (cobre repouso de cron e re-execução manual).
 *
 * Auth: header `Authorization: Bearer <CRON_SECRET>`. Vercel Cron já
 * adiciona automaticamente quando configurado em vercel.json.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const sb = createAdminClient();

  // Lições com drip por dias (publicadas). Pega só o que importa.
  const { data: lessons } = await sb
    .schema("membros")
    .from("lessons")
    .select("id, title, module_id, release_days, release_type")
    .eq("release_type", "days_after_enrollment")
    .gt("release_days", 0);

  const lessonsList = (lessons ?? []) as Array<{
    id: string;
    title: string;
    module_id: string;
    release_days: number;
    release_type: string;
  }>;

  if (lessonsList.length === 0) {
    return NextResponse.json({ ok: true, notified: 0, lessons: 0 });
  }

  // Mapa lessonId → courseId via module
  const moduleIds = Array.from(new Set(lessonsList.map((l) => l.module_id)));
  const { data: modules } = await sb
    .schema("membros")
    .from("modules")
    .select("id, course_id")
    .in("id", moduleIds);
  const moduleToCourse = new Map(
    ((modules ?? []) as Array<{ id: string; course_id: string }>).map((m) => [
      m.id,
      m.course_id,
    ]),
  );

  // Matrículas ativas (nowIso < expires_at OR null)
  const nowIso = new Date().toISOString();
  const { data: enrollments } = await sb
    .schema("membros")
    .from("enrollments")
    .select("user_id, cohort_id, enrolled_at, expires_at")
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  const enrollList = (enrollments ?? []) as Array<{
    user_id: string;
    cohort_id: string;
    enrolled_at: string;
    expires_at: string | null;
  }>;

  // Mapa cohort → array of course_id
  const cohortIds = Array.from(new Set(enrollList.map((e) => e.cohort_id)));
  const { data: cohortCourses } = await sb
    .schema("membros")
    .from("cohort_courses")
    .select("cohort_id, course_id")
    .in("cohort_id", cohortIds);
  const cohortToCourses = new Map<string, Set<string>>();
  for (const cc of (cohortCourses ?? []) as Array<{
    cohort_id: string;
    course_id: string;
  }>) {
    const set = cohortToCourses.get(cc.cohort_id) ?? new Set<string>();
    set.add(cc.course_id);
    cohortToCourses.set(cc.cohort_id, set);
  }

  let notified = 0;
  const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const todayUtc = new Date();

  for (const enr of enrollList) {
    const enrolledDate = new Date(enr.enrolled_at);
    const days = Math.floor(
      (todayUtc.getTime() - enrolledDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days <= 0) continue;

    const userCourseIds = cohortToCourses.get(enr.cohort_id) ?? new Set();
    if (userCourseIds.size === 0) continue;

    for (const lesson of lessonsList) {
      if (lesson.release_days !== days) continue;
      const courseId = moduleToCourse.get(lesson.module_id);
      if (!courseId || !userCourseIds.has(courseId)) continue;

      // Idempotência: já notificou esse user dessa lesson nas últimas 48h?
      const link = `/lessons/${lesson.id}`;
      const { count: existing } = await sb
        .schema("membros")
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", enr.user_id)
        .eq("link", link)
        .gte("created_at", since48h);
      if ((existing ?? 0) > 0) continue;

      await notifyAndEmail({
        userId: enr.user_id,
        title: "Nova aula liberada pra você",
        body: `"${lesson.title}" acabou de abrir no seu acesso.`,
        link,
        ctaLabel: "Ver aula",
        pushCategory: "lesson_drip",
      });
      notified++;
    }
  }

  return NextResponse.json({
    ok: true,
    notified,
    lessons: lessonsList.length,
    enrollments: enrollList.length,
  });
}
