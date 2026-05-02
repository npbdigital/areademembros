import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  History,
  Layers,
  NotebookPen,
  PlayCircle,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface AccessLogRow {
  id: string;
  lesson_id: string | null;
  action: string;
  created_at: string;
}

interface LessonInfoRow {
  id: string;
  title: string;
  module_id: string;
  modules:
    | {
        title: string;
        course_id: string;
        courses:
          | { id: string; title: string }
          | { id: string; title: string }[]
          | null;
      }
    | {
        title: string;
        course_id: string;
        courses:
          | { id: string; title: string }
          | { id: string; title: string }[]
          | null;
      }[]
    | null;
}

interface NoteRow {
  id: string;
  lesson_id: string;
  content: string;
  updated_at: string;
}

interface ProgressRow {
  lesson_id: string;
  is_completed: boolean | null;
  watch_time_seconds: number | null;
  last_watched_at: string | null;
}

export default async function StudentActivityPage({
  params,
}: {
  params: { id: string };
}) {
  // RLS de access_logs / lesson_progress / lesson_notes filtra por auth.uid().
  // Como aqui o admin lê dados de OUTRO usuário, usamos o admin client (service_role)
  // pra contornar — a checagem de admin já roda no layout /admin.
  const supabase = createAdminClient();
  const userId = params.id;

  const { data: student } = await supabase
    .schema("membros")
    .from("users")
    .select("id, full_name, email, role, created_at")
    .eq("id", userId)
    .single();

  if (!student) notFound();

  // Cohorts ativos do aluno → cursos que ele tem acesso
  const nowIso = new Date().toISOString();
  const { data: enrollments } = await supabase
    .schema("membros")
    .from("enrollments")
    .select("cohort_id, enrolled_at, expires_at, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  const cohortIds = (enrollments ?? []).map((e) => e.cohort_id);

  let courseIds: string[] = [];
  if (cohortIds.length > 0) {
    const { data: links } = await supabase
      .schema("membros")
      .from("cohort_courses")
      .select("course_id")
      .in("cohort_id", cohortIds);
    courseIds = Array.from(
      new Set(
        ((links ?? []) as Array<{ course_id: string }>).map((l) => l.course_id),
      ),
    );
  }

  // Cursos do aluno + módulos + lições (pra calcular progresso)
  let courseSummaries: Array<{
    courseId: string;
    courseTitle: string;
    totalLessons: number;
    completedLessons: number;
  }> = [];

  if (courseIds.length > 0) {
    const { data: courses } = await supabase
      .schema("membros")
      .from("courses")
      .select("id, title")
      .in("id", courseIds);

    const { data: modulesData } = await supabase
      .schema("membros")
      .from("modules")
      .select("id, course_id")
      .in("course_id", courseIds);
    const modules = (modulesData ?? []) as Array<{
      id: string;
      course_id: string;
    }>;

    const moduleIds = modules.map((m) => m.id);
    let lessons: Array<{ id: string; module_id: string }> = [];
    if (moduleIds.length > 0) {
      const { data: l } = await supabase
        .schema("membros")
        .from("lessons")
        .select("id, module_id")
        .in("module_id", moduleIds);
      lessons = (l ?? []) as Array<{ id: string; module_id: string }>;
    }

    const courseByModule = new Map(modules.map((m) => [m.id, m.course_id]));
    const lessonIdsByCourse = new Map<string, string[]>();
    for (const lesson of lessons) {
      const courseId = courseByModule.get(lesson.module_id);
      if (!courseId) continue;
      const arr = lessonIdsByCourse.get(courseId) ?? [];
      arr.push(lesson.id);
      lessonIdsByCourse.set(courseId, arr);
    }

    const allLessonIds = lessons.map((l) => l.id);
    const completedSet = new Set<string>();
    if (allLessonIds.length > 0) {
      const { data: progress } = await supabase
        .schema("membros")
        .from("lesson_progress")
        .select("lesson_id")
        .eq("user_id", userId)
        .eq("is_completed", true)
        .in("lesson_id", allLessonIds);
      for (const p of (progress ?? []) as Array<{ lesson_id: string }>) {
        completedSet.add(p.lesson_id);
      }
    }

    courseSummaries = ((courses ?? []) as Array<{ id: string; title: string }>)
      .map((c) => {
        const lessonIds = lessonIdsByCourse.get(c.id) ?? [];
        const completed = lessonIds.filter((id) => completedSet.has(id)).length;
        return {
          courseId: c.id,
          courseTitle: c.title,
          totalLessons: lessonIds.length,
          completedLessons: completed,
        };
      })
      .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));
  }

  // Timeline de access_logs (últimas 50 lesson_view + lesson_complete)
  const { data: rawLogs } = await supabase
    .schema("membros")
    .from("access_logs")
    .select("id, lesson_id, action, created_at")
    .eq("user_id", userId)
    .in("action", ["lesson_view", "lesson_complete"])
    .not("lesson_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const logs = (rawLogs ?? []) as AccessLogRow[];
  const lessonIdsInLogs = Array.from(
    new Set(logs.map((l) => l.lesson_id).filter((x): x is string => Boolean(x))),
  );

  const lessonInfoMap = new Map<
    string,
    { title: string; moduleTitle: string; courseTitle: string; courseId: string }
  >();

  if (lessonIdsInLogs.length > 0) {
    const { data: lessonInfo } = await supabase
      .schema("membros")
      .from("lessons")
      .select(
        "id, title, module_id, modules(title, course_id, courses(id, title))",
      )
      .in("id", lessonIdsInLogs);

    for (const row of (lessonInfo ?? []) as unknown as LessonInfoRow[]) {
      const mod = Array.isArray(row.modules) ? row.modules[0] : row.modules;
      if (!mod) continue;
      const course = Array.isArray(mod.courses) ? mod.courses[0] : mod.courses;
      if (!course) continue;
      lessonInfoMap.set(row.id, {
        title: row.title,
        moduleTitle: mod.title,
        courseTitle: course.title,
        courseId: course.id,
      });
    }
  }

  const lastAccess = logs[0]?.created_at ?? null;

  // Anotações do aluno
  const { data: rawNotes } = await supabase
    .schema("membros")
    .from("lesson_notes")
    .select("id, lesson_id, content, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(20);
  const notes = (rawNotes ?? []) as NoteRow[];

  const { data: rawRatings } = await supabase
    .schema("membros")
    .from("lesson_ratings")
    .select("id, lesson_id, rating, comment, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Progresso bruto pra "watch time total"
  const { data: progressRows } = await supabase
    .schema("membros")
    .from("lesson_progress")
    .select("lesson_id, is_completed, watch_time_seconds, last_watched_at")
    .eq("user_id", userId);
  const allProgress = (progressRows ?? []) as ProgressRow[];
  const totalWatchSeconds = allProgress.reduce(
    (sum, p) => sum + (p.watch_time_seconds ?? 0),
    0,
  );

  // Stats agregadas
  const totalCompleted = allProgress.filter((p) => p.is_completed).length;
  const lessonsViewedSet = new Set(
    logs.filter((l) => l.action === "lesson_view").map((l) => l.lesson_id),
  );
  const distinctViewed = lessonsViewedSet.size;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link
          href={`/admin/students/${userId}`}
          className="inline-flex items-center gap-1.5 text-sm text-npb-text-muted hover:text-npb-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar pro perfil
        </Link>
      </div>

      <header>
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
          <History className="h-3.5 w-3.5" />
          Atividade
        </div>
        <h1 className="text-xl font-bold text-npb-text">
          {student.full_name || student.email}
        </h1>
        <p className="text-sm text-npb-text-muted">{student.email}</p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Último acesso"
          value={lastAccess ? formatRelativeDateTime(lastAccess) : "—"}
        />
        <StatCard
          label="Aulas vistas"
          value={distinctViewed.toString()}
          hint="distintas"
        />
        <StatCard
          label="Aulas concluídas"
          value={totalCompleted.toString()}
        />
        <StatCard
          label="Tempo total"
          value={formatHours(totalWatchSeconds)}
        />
      </section>

      <section>
        <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-bold text-npb-text">
          <Layers className="h-5 w-5 text-npb-gold" />
          Progresso por curso
        </h2>
        {courseSummaries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-6 text-center text-sm text-npb-text-muted">
            Aluno sem matrícula ativa.
          </div>
        ) : (
          <ul className="space-y-2">
            {courseSummaries.map((c) => {
              const pct =
                c.totalLessons > 0
                  ? Math.round((c.completedLessons / c.totalLessons) * 100)
                  : 0;
              return (
                <li
                  key={c.courseId}
                  className="rounded-xl border border-npb-border bg-npb-bg2 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-npb-text">
                      {c.courseTitle}
                    </span>
                    <span className="text-xs text-npb-text-muted">
                      {c.completedLessons}/{c.totalLessons} aulas ·{" "}
                      <span className="font-semibold text-npb-gold">{pct}%</span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-npb-bg4">
                    <div
                      className="h-full bg-npb-gold-gradient"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-bold text-npb-text">
          <PlayCircle className="h-5 w-5 text-npb-gold" />
          Timeline (últimos 50 eventos)
        </h2>
        {logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-6 text-center text-sm text-npb-text-muted">
            Sem registros ainda.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {logs.map((log) => {
              const info = log.lesson_id
                ? lessonInfoMap.get(log.lesson_id)
                : null;
              const isComplete = log.action === "lesson_complete";
              return (
                <li
                  key={log.id}
                  className="flex items-start gap-3 rounded-lg border border-npb-border bg-npb-bg2 p-3"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-npb-gold" />
                    ) : (
                      <PlayCircle className="h-4 w-4 text-npb-text-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-medium text-npb-text">
                        {info?.title ?? "(aula removida)"}
                      </span>
                      {isComplete && (
                        <span className="rounded bg-npb-gold/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-npb-gold">
                          concluída
                        </span>
                      )}
                    </div>
                    {info && (
                      <p className="text-xs text-npb-text-muted">
                        {info.courseTitle} · {info.moduleTitle}
                      </p>
                    )}
                  </div>
                  <span className="flex flex-shrink-0 items-center gap-1 text-[11px] text-npb-text-muted">
                    <Clock className="h-3 w-3" />
                    {formatRelativeDateTime(log.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {notes.length > 0 && (
        <section>
          <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-bold text-npb-text">
            <NotebookPen className="h-5 w-5 text-npb-gold" />
            Anotações do aluno ({notes.length})
          </h2>
          <ul className="space-y-2">
            {notes.map((note) => {
              const info = lessonInfoMap.get(note.lesson_id);
              return (
                <li
                  key={note.id}
                  className="rounded-xl border border-npb-border bg-npb-bg2 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-npb-gold">
                    {info?.courseTitle ?? "Curso"}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-npb-text">
                    {info?.title ?? "(aula)"}
                  </p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-npb-text-muted">
                    {note.content}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-npb-text-muted">
                    <Calendar className="h-3 w-3" />
                    {formatRelativeDateTime(note.updated_at)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(rawRatings ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-bold text-npb-text">
            <CheckCircle2 className="h-5 w-5 text-npb-gold" />
            Avaliações do aluno ({(rawRatings ?? []).length})
          </h2>
          <ul className="space-y-2">
            {((rawRatings ?? []) as Array<{
              id: string;
              lesson_id: string;
              rating: number;
              comment: string | null;
              created_at: string;
            }>).map((r) => {
              const info = lessonInfoMap.get(r.lesson_id);
              return (
                <li
                  key={r.id}
                  className="rounded-xl border border-npb-border bg-npb-bg2 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-npb-gold">
                        {info?.courseTitle ?? "Curso"}
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-npb-text">
                        {info?.title ?? "(aula)"}
                      </p>
                    </div>
                    <span className="flex flex-shrink-0 items-center gap-0.5 rounded bg-npb-gold/15 px-2 py-1 text-sm font-semibold text-npb-gold">
                      ★ {r.rating}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-npb-text">
                      {r.comment}
                    </p>
                  )}
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-npb-text-muted">
                    <Calendar className="h-3 w-3" />
                    {formatRelativeDateTime(r.created_at)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-npb-border bg-npb-bg2 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-npb-text-muted">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-npb-text">{value}</p>
      {hint && <p className="text-[10px] text-npb-text-muted">{hint}</p>}
    </div>
  );
}

function formatRelativeDateTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h atrás`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d atrás`;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatHours(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}min`;
}
