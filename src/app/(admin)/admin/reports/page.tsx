import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  MessageSquare,
  PlayCircle,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getNonStudentUserIds } from "@/lib/access";

export const dynamic = "force-dynamic";

type Period = "7d" | "30d" | "90d" | "all";

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "all", label: "Tudo" },
];

interface SearchParams {
  period?: string;
  course?: string;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const period: Period =
    searchParams.period === "7d" ||
    searchParams.period === "30d" ||
    searchParams.period === "90d" ||
    searchParams.period === "all"
      ? searchParams.period
      : "30d";
  const selectedCourseId = searchParams.course?.trim() || null;
  const sinceIso = sinceFromPeriod(period);

  const supabase = createClient();
  const adminSupabase = createAdminClient();
  const excludedUserIds = await getNonStudentUserIds(supabase);

  const { data: coursesData } = await supabase
    .schema("membros")
    .from("courses")
    .select("id, title, cover_url, is_published")
    .eq("is_published", true)
    .order("title", { ascending: true });
  const courses = (coursesData ?? []) as Array<{
    id: string;
    title: string;
    cover_url: string | null;
    is_published: boolean;
  }>;

  // Contagem de alunos ativos por curso
  const studentsByCourse = await getStudentCountsByCourse(
    supabase,
    courses.map((c) => c.id),
    excludedUserIds,
  );

  // Resumo agregado por curso (pra cards e fallback)
  const courseSummaries = await Promise.all(
    courses.map((c) =>
      buildCourseSummary(
        supabase,
        c.id,
        studentsByCourse.get(c.id) ?? 0,
        excludedUserIds,
        sinceIso,
      ),
    ),
  );

  const selected = selectedCourseId
    ? courses.find((c) => c.id === selectedCourseId) ?? null
    : null;

  const detailed = selected
    ? await buildCourseDetail(
        supabase,
        selected.id,
        studentsByCourse.get(selected.id) ?? 0,
        excludedUserIds,
        sinceIso,
      )
    : null;

  const topRated = await loadTopRatedLessons(adminSupabase, sinceIso);
  const recentComments = await loadRecentRatingComments(adminSupabase, sinceIso);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
            <BarChart3 className="h-3.5 w-3.5" />
            Relatórios
          </div>
          <h1 className="text-2xl font-bold text-npb-text">Engajamento</h1>
          <p className="text-sm text-npb-text-muted">
            Aulas mais vistas, conclusões e avaliações. Admin e moderadores
            ficam fora das contagens.
          </p>
        </div>
        <PeriodChips current={period} courseId={selectedCourseId} />
      </header>

      {selected ? (
        <CourseDetailSection
          course={selected}
          detail={detailed!}
          period={period}
        />
      ) : (
        <CoursesSummarySection summaries={courseSummaries} period={period} />
      )}

      <section>
        <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-bold text-npb-text">
          <Star className="h-5 w-5 text-npb-gold" />
          Top aulas por nota{" "}
          <span className="text-xs font-normal text-npb-text-muted">
            (mín. 3 avaliações)
          </span>
        </h2>
        {topRated.length === 0 ? (
          <EmptyBlock>Sem avaliações suficientes no período.</EmptyBlock>
        ) : (
          <ul className="space-y-2">
            {topRated.map((r) => (
              <li
                key={r.lessonId}
                className="flex items-center gap-3 rounded-xl border border-npb-border bg-npb-bg2 p-3"
              >
                <span className="flex w-12 flex-shrink-0 items-center gap-0.5 rounded bg-npb-gold/15 px-2 py-1 text-sm font-bold text-npb-gold">
                  ★ {r.average.toFixed(1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-npb-text">
                    {r.lessonTitle}
                  </p>
                  <p className="truncate text-xs text-npb-text-muted">
                    {r.courseTitle} · {r.moduleTitle}
                  </p>
                </div>
                <span className="flex-shrink-0 text-[11px] text-npb-text-muted">
                  {r.count} {r.count === 1 ? "avaliação" : "avaliações"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-bold text-npb-text">
          <MessageSquare className="h-5 w-5 text-npb-gold" />
          Últimos comentários
        </h2>
        {recentComments.length === 0 ? (
          <EmptyBlock>Nenhum comentário no período.</EmptyBlock>
        ) : (
          <ul className="space-y-2">
            {recentComments.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-npb-border bg-npb-bg2 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-npb-gold">
                      {c.courseTitle}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-npb-text">
                      {c.lessonTitle}
                    </p>
                  </div>
                  <span className="flex flex-shrink-0 items-center gap-0.5 rounded bg-npb-gold/15 px-2 py-1 text-sm font-semibold text-npb-gold">
                    ★ {c.rating}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-npb-text">
                  {c.comment}
                </p>
                <p className="mt-2 text-[11px] text-npb-text-muted">
                  {c.studentName} · {formatDate(c.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ============================================================
// SECTIONS
// ============================================================

function CoursesSummarySection({
  summaries,
  period,
}: {
  summaries: CourseSummary[];
  period: Period;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-npb-text">Cursos</h2>
      {summaries.length === 0 ? (
        <EmptyBlock>Nenhum curso publicado ainda.</EmptyBlock>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((s) => (
            <Link
              key={s.courseId}
              href={`/admin/reports?course=${s.courseId}&period=${period}`}
              className="group flex flex-col gap-3 rounded-xl border border-npb-border bg-npb-bg2 p-4 transition hover:border-npb-gold/60 hover:shadow-npb-card-hover"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 text-sm font-semibold text-npb-text group-hover:text-npb-gold">
                  {s.courseTitle}
                </h3>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-npb-text-muted group-hover:text-npb-gold" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Alunos" value={s.studentCount.toString()} />
                <Stat
                  label="Vis. médias"
                  value={`${s.avgViewPct}%`}
                  tone={trendTone(s.avgViewPct)}
                />
                <Stat
                  label="Conclusão"
                  value={`${s.avgCompletionPct}%`}
                  tone={trendTone(s.avgCompletionPct)}
                />
              </div>
              <p className="text-[11px] text-npb-text-muted">
                {s.lessonCount} {s.lessonCount === 1 ? "aula" : "aulas"} no
                curso
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function CourseDetailSection({
  course,
  detail,
  period,
}: {
  course: { id: string; title: string };
  detail: CourseDetail;
  period: Period;
}) {
  const sortedDesc = [...detail.lessons].sort((a, b) => b.viewPct - a.viewPct);
  const top = sortedDesc.slice(0, 10);
  const tail = sortedDesc.slice(-5).reverse();

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-npb-text">{course.title}</h2>
          <p className="text-xs text-npb-text-muted">
            {detail.studentCount}{" "}
            {detail.studentCount === 1 ? "aluno" : "alunos"} com acesso ·{" "}
            {detail.lessons.length}{" "}
            {detail.lessons.length === 1 ? "aula" : "aulas"}
          </p>
        </div>
        <Link
          href={`/admin/reports?period=${period}`}
          className="text-xs text-npb-text-muted transition hover:text-npb-gold"
        >
          ← Ver todos os cursos
        </Link>
      </div>

      {detail.lessons.length === 0 ? (
        <EmptyBlock>Esse curso ainda não tem aulas.</EmptyBlock>
      ) : (
        <>
          <div>
            <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-npb-text">
              <TrendingUp className="h-4 w-4 text-green-400" />
              Aulas mais vistas
            </h3>
            <LessonRowsTable lessons={top} totalStudents={detail.studentCount} />
          </div>

          {tail.length > 0 && detail.lessons.length > 5 && (
            <div>
              <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-npb-text">
                <TrendingDown className="h-4 w-4 text-red-400" />
                Menor engajamento
              </h3>
              <LessonRowsTable
                lessons={tail}
                totalStudents={detail.studentCount}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}

function LessonRowsTable({
  lessons,
  totalStudents,
}: {
  lessons: LessonStat[];
  totalStudents: number;
}) {
  return (
    <ul className="space-y-1.5">
      {lessons.map((l) => (
        <li
          key={l.lessonId}
          className="flex items-center gap-3 rounded-lg border border-npb-border bg-npb-bg2 p-3"
        >
          <PlayCircle className="h-4 w-4 flex-shrink-0 text-npb-text-muted" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-npb-text">
              {l.lessonTitle}
            </p>
            <p className="truncate text-xs text-npb-text-muted">
              {l.moduleTitle}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-3 text-xs">
            <span
              className="inline-flex items-center gap-1 text-npb-text-muted"
              title="Alunos que abriram"
            >
              <PlayCircle className="h-3 w-3" />
              <span className="font-semibold text-npb-text">
                {l.viewCount}
              </span>
              /{totalStudents}
              <span className="ml-1 font-semibold text-npb-gold">
                {l.viewPct}%
              </span>
            </span>
            <span
              className="inline-flex items-center gap-1 text-npb-text-muted"
              title="Alunos que concluíram"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span className="font-semibold text-npb-text">
                {l.completeCount}
              </span>
              <span className="ml-1 font-semibold text-npb-gold">
                {l.completePct}%
              </span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PeriodChips({
  current,
  courseId,
}: {
  current: Period;
  courseId: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-npb-border bg-npb-bg2 p-1">
      {PERIODS.map((p) => {
        const href =
          `/admin/reports?period=${p.value}` +
          (courseId ? `&course=${courseId}` : "");
        const active = p.value === current;
        return (
          <Link
            key={p.value}
            href={href}
            className={
              "rounded-md px-3 py-1.5 text-xs font-semibold transition " +
              (active
                ? "bg-npb-gold text-black"
                : "text-npb-text-muted hover:text-npb-text")
            }
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const color =
    tone === "good"
      ? "text-green-400"
      : tone === "warn"
        ? "text-yellow-400"
        : tone === "bad"
          ? "text-red-400"
          : "text-npb-text";
  return (
    <div className="rounded-md bg-npb-bg3 p-2">
      <p className="text-[9px] uppercase tracking-wide text-npb-text-muted">
        {label}
      </p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

function EmptyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-6 text-center text-sm text-npb-text-muted">
      {children}
    </div>
  );
}

function trendTone(pct: number): "good" | "warn" | "bad" | "neutral" {
  if (pct >= 60) return "good";
  if (pct >= 30) return "warn";
  if (pct > 0) return "bad";
  return "neutral";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ============================================================
// DATA HELPERS
// ============================================================

function sinceFromPeriod(p: Period): string | null {
  if (p === "all") return null;
  const days = p === "7d" ? 7 : p === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

interface CourseSummary {
  courseId: string;
  courseTitle: string;
  studentCount: number;
  lessonCount: number;
  avgViewPct: number;
  avgCompletionPct: number;
}

interface LessonStat {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  viewCount: number;
  viewPct: number;
  completeCount: number;
  completePct: number;
}

interface CourseDetail {
  studentCount: number;
  lessons: LessonStat[];
}

async function getStudentCountsByCourse(
  supabase: ReturnType<typeof createClient>,
  courseIds: string[],
  excludedUserIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (courseIds.length === 0) return result;

  const nowIso = new Date().toISOString();
  const { data: links } = await supabase
    .schema("membros")
    .from("cohort_courses")
    .select("course_id, cohort_id")
    .in("course_id", courseIds);

  const cohortByCourse = new Map<string, string[]>();
  for (const link of (links ?? []) as Array<{
    course_id: string;
    cohort_id: string;
  }>) {
    const arr = cohortByCourse.get(link.course_id) ?? [];
    arr.push(link.cohort_id);
    cohortByCourse.set(link.course_id, arr);
  }

  const allCohortIds = Array.from(
    new Set(Array.from(cohortByCourse.values()).flat()),
  );

  if (allCohortIds.length === 0) {
    courseIds.forEach((id) => result.set(id, 0));
    return result;
  }

  let query = supabase
    .schema("membros")
    .from("enrollments")
    .select("user_id, cohort_id")
    .in("cohort_id", allCohortIds)
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  if (excludedUserIds.length > 0) {
    query = query.not("user_id", "in", `(${excludedUserIds.join(",")})`);
  }
  const { data: enrollments } = await query;

  const usersByCohort = new Map<string, Set<string>>();
  for (const e of (enrollments ?? []) as Array<{
    user_id: string;
    cohort_id: string;
  }>) {
    const set = usersByCohort.get(e.cohort_id) ?? new Set<string>();
    set.add(e.user_id);
    usersByCohort.set(e.cohort_id, set);
  }

  for (const courseId of courseIds) {
    const cohorts = cohortByCourse.get(courseId) ?? [];
    const userSet = new Set<string>();
    for (const cohortId of cohorts) {
      const users = usersByCohort.get(cohortId);
      if (!users) continue;
      users.forEach((u) => userSet.add(u));
    }
    result.set(courseId, userSet.size);
  }

  return result;
}

async function buildCourseSummary(
  supabase: ReturnType<typeof createClient>,
  courseId: string,
  studentCount: number,
  excludedUserIds: string[],
  sinceIso: string | null,
): Promise<CourseSummary> {
  const detail = await buildCourseDetail(
    supabase,
    courseId,
    studentCount,
    excludedUserIds,
    sinceIso,
  );

  const { data: courseData } = await supabase
    .schema("membros")
    .from("courses")
    .select("title")
    .eq("id", courseId)
    .single();

  const totalView = detail.lessons.reduce((s, l) => s + l.viewPct, 0);
  const totalComplete = detail.lessons.reduce((s, l) => s + l.completePct, 0);
  const n = detail.lessons.length;

  return {
    courseId,
    courseTitle: (courseData as { title: string } | null)?.title ?? "(curso)",
    studentCount,
    lessonCount: n,
    avgViewPct: n > 0 ? Math.round(totalView / n) : 0,
    avgCompletionPct: n > 0 ? Math.round(totalComplete / n) : 0,
  };
}

async function buildCourseDetail(
  supabase: ReturnType<typeof createClient>,
  courseId: string,
  studentCount: number,
  excludedUserIds: string[],
  sinceIso: string | null,
): Promise<CourseDetail> {
  const { data: modulesData } = await supabase
    .schema("membros")
    .from("modules")
    .select("id, title, position")
    .eq("course_id", courseId)
    .order("position", { ascending: true });
  const modules = (modulesData ?? []) as Array<{
    id: string;
    title: string;
    position: number;
  }>;

  const moduleIds = modules.map((m) => m.id);
  if (moduleIds.length === 0) {
    return { studentCount, lessons: [] };
  }

  const { data: lessonsData } = await supabase
    .schema("membros")
    .from("lessons")
    .select("id, title, module_id, position")
    .in("module_id", moduleIds)
    .order("position", { ascending: true });
  const lessons = (lessonsData ?? []) as Array<{
    id: string;
    title: string;
    module_id: string;
    position: number;
  }>;

  const lessonIds = lessons.map((l) => l.id);
  if (lessonIds.length === 0) {
    return { studentCount, lessons: [] };
  }

  // Visualizações distintas
  let viewQuery = supabase
    .schema("membros")
    .from("access_logs")
    .select("user_id, lesson_id")
    .eq("action", "lesson_view")
    .in("lesson_id", lessonIds);
  if (sinceIso) viewQuery = viewQuery.gte("created_at", sinceIso);
  if (excludedUserIds.length > 0) {
    viewQuery = viewQuery.not("user_id", "in", `(${excludedUserIds.join(",")})`);
  }
  const { data: views } = await viewQuery;

  // Conclusões
  let completeQuery = supabase
    .schema("membros")
    .from("lesson_progress")
    .select("user_id, lesson_id, completed_at")
    .eq("is_completed", true)
    .in("lesson_id", lessonIds);
  if (sinceIso) completeQuery = completeQuery.gte("completed_at", sinceIso);
  if (excludedUserIds.length > 0) {
    completeQuery = completeQuery.not(
      "user_id",
      "in",
      `(${excludedUserIds.join(",")})`,
    );
  }
  const { data: completes } = await completeQuery;

  const distinctViewers = new Map<string, Set<string>>();
  for (const v of (views ?? []) as Array<{
    user_id: string;
    lesson_id: string;
  }>) {
    const set = distinctViewers.get(v.lesson_id) ?? new Set<string>();
    set.add(v.user_id);
    distinctViewers.set(v.lesson_id, set);
  }

  const distinctCompleters = new Map<string, Set<string>>();
  for (const c of (completes ?? []) as Array<{
    user_id: string;
    lesson_id: string;
  }>) {
    const set = distinctCompleters.get(c.lesson_id) ?? new Set<string>();
    set.add(c.user_id);
    distinctCompleters.set(c.lesson_id, set);
  }

  const moduleTitleById = new Map(modules.map((m) => [m.id, m.title]));

  const result: LessonStat[] = lessons.map((l) => {
    const viewCount = distinctViewers.get(l.id)?.size ?? 0;
    const completeCount = distinctCompleters.get(l.id)?.size ?? 0;
    const viewPct =
      studentCount > 0 ? Math.round((viewCount / studentCount) * 100) : 0;
    const completePct =
      studentCount > 0 ? Math.round((completeCount / studentCount) * 100) : 0;
    return {
      lessonId: l.id,
      lessonTitle: l.title,
      moduleTitle: moduleTitleById.get(l.module_id) ?? "",
      viewCount,
      viewPct,
      completeCount,
      completePct,
    };
  });

  return { studentCount, lessons: result };
}

interface TopRated {
  lessonId: string;
  lessonTitle: string;
  courseTitle: string;
  moduleTitle: string;
  average: number;
  count: number;
}

async function loadTopRatedLessons(
  adminSupabase: ReturnType<typeof createAdminClient>,
  sinceIso: string | null,
): Promise<TopRated[]> {
  let q = adminSupabase
    .schema("membros")
    .from("lesson_ratings")
    .select("lesson_id, rating, created_at");
  if (sinceIso) q = q.gte("created_at", sinceIso);
  const { data: ratings } = await q;

  const sumByLesson = new Map<string, { sum: number; count: number }>();
  for (const r of (ratings ?? []) as Array<{
    lesson_id: string;
    rating: number;
  }>) {
    const cur = sumByLesson.get(r.lesson_id) ?? { sum: 0, count: 0 };
    cur.sum += r.rating;
    cur.count += 1;
    sumByLesson.set(r.lesson_id, cur);
  }

  const top = Array.from(sumByLesson.entries())
    .filter(([, v]) => v.count >= 3)
    .map(([lessonId, v]) => ({
      lessonId,
      average: v.sum / v.count,
      count: v.count,
    }))
    .sort((a, b) => b.average - a.average || b.count - a.count)
    .slice(0, 10);

  if (top.length === 0) return [];

  const lessonIds = top.map((t) => t.lessonId);
  const lessonInfo = await loadLessonInfo(adminSupabase, lessonIds);

  return top.map((t) => {
    const info = lessonInfo.get(t.lessonId);
    return {
      lessonId: t.lessonId,
      lessonTitle: info?.lessonTitle ?? "(aula)",
      courseTitle: info?.courseTitle ?? "",
      moduleTitle: info?.moduleTitle ?? "",
      average: t.average,
      count: t.count,
    };
  });
}

interface RecentComment {
  id: string;
  lessonId: string;
  lessonTitle: string;
  courseTitle: string;
  rating: number;
  comment: string;
  studentName: string;
  createdAt: string;
}

async function loadRecentRatingComments(
  adminSupabase: ReturnType<typeof createAdminClient>,
  sinceIso: string | null,
): Promise<RecentComment[]> {
  let q = adminSupabase
    .schema("membros")
    .from("lesson_ratings")
    .select("id, lesson_id, user_id, rating, comment, created_at")
    .not("comment", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);
  if (sinceIso) q = q.gte("created_at", sinceIso);
  const { data: rows } = await q;

  const list = ((rows ?? []) as Array<{
    id: string;
    lesson_id: string;
    user_id: string;
    rating: number;
    comment: string;
    created_at: string;
  }>).filter((r) => r.comment && r.comment.trim().length > 0);

  if (list.length === 0) return [];

  const lessonIds = Array.from(new Set(list.map((r) => r.lesson_id)));
  const userIds = Array.from(new Set(list.map((r) => r.user_id)));

  const [lessonInfo, userInfo] = await Promise.all([
    loadLessonInfo(adminSupabase, lessonIds),
    loadUserNames(adminSupabase, userIds),
  ]);

  return list.map((r) => {
    const info = lessonInfo.get(r.lesson_id);
    return {
      id: r.id,
      lessonId: r.lesson_id,
      lessonTitle: info?.lessonTitle ?? "(aula)",
      courseTitle: info?.courseTitle ?? "",
      rating: r.rating,
      comment: r.comment,
      studentName: userInfo.get(r.user_id) ?? "(aluno)",
      createdAt: r.created_at,
    };
  });
}

async function loadLessonInfo(
  client: ReturnType<typeof createAdminClient>,
  lessonIds: string[],
): Promise<
  Map<string, { lessonTitle: string; moduleTitle: string; courseTitle: string }>
> {
  const result = new Map<
    string,
    { lessonTitle: string; moduleTitle: string; courseTitle: string }
  >();
  if (lessonIds.length === 0) return result;

  const { data } = await client
    .schema("membros")
    .from("lessons")
    .select("id, title, modules(title, courses(title))")
    .in("id", lessonIds);

  for (const row of (data ?? []) as unknown as Array<{
    id: string;
    title: string;
    modules:
      | { title: string; courses: { title: string } | { title: string }[] | null }
      | { title: string; courses: { title: string } | { title: string }[] | null }[]
      | null;
  }>) {
    const mod = Array.isArray(row.modules) ? row.modules[0] : row.modules;
    if (!mod) continue;
    const course = Array.isArray(mod.courses) ? mod.courses[0] : mod.courses;
    result.set(row.id, {
      lessonTitle: row.title,
      moduleTitle: mod.title,
      courseTitle: course?.title ?? "",
    });
  }

  return result;
}

async function loadUserNames(
  client: ReturnType<typeof createAdminClient>,
  userIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (userIds.length === 0) return result;

  const { data } = await client
    .schema("membros")
    .from("users")
    .select("id, full_name, email")
    .in("id", userIds);

  for (const row of (data ?? []) as Array<{
    id: string;
    full_name: string | null;
    email: string;
  }>) {
    result.set(row.id, row.full_name?.trim() || row.email);
  }
  return result;
}
