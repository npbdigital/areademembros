import Link from "next/link";
import { Play } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCourseAccessMap } from "@/lib/access";
import { OwnedCourseCard, SaleCourseCard } from "@/components/student/course-card";

export const dynamic = "force-dynamic";

interface CourseRow {
  id: string;
  title: string;
  cover_url: string | null;
  is_published: boolean;
  is_for_sale: boolean;
  sale_url: string | null;
  position: number;
}

interface ModuleRow {
  id: string;
  course_id: string;
}

interface LessonRow {
  id: string;
  module_id: string;
}

type ModuleRef = { course_id: string };
interface LessonWithCourseRow {
  id: string;
  title: string;
  module_id: string;
  youtube_video_id: string | null;
  modules: ModuleRef | ModuleRef[] | null;
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const accessMap = await getCourseAccessMap(supabase, user.id);
  const ownedCourseIds = Array.from(accessMap.keys());

  const { data: allCourses } = await supabase
    .schema("membros")
    .from("courses")
    .select("id, title, cover_url, is_published, is_for_sale, sale_url, position")
    .eq("is_published", true)
    .order("position", { ascending: true });

  const courses = (allCourses ?? []) as CourseRow[];
  const ownedSet = new Set(ownedCourseIds);
  const ownedCourses = courses.filter((c) => ownedSet.has(c.id));
  const availableCourses = courses.filter(
    (c) => !ownedSet.has(c.id) && c.is_for_sale,
  );

  const ownedCourseIdsArr = ownedCourses.map((c) => c.id);
  const lessonCountByCourse = new Map<string, number>();
  const lessonIdsByCourse = new Map<string, string[]>();

  if (ownedCourseIdsArr.length > 0) {
    const { data: modulesData } = await supabase
      .schema("membros")
      .from("modules")
      .select("id, course_id")
      .in("course_id", ownedCourseIdsArr);
    const modules = (modulesData ?? []) as ModuleRow[];

    const moduleIds = modules.map((m) => m.id);
    let lessons: LessonRow[] = [];
    if (moduleIds.length > 0) {
      const { data: lessonsData } = await supabase
        .schema("membros")
        .from("lessons")
        .select("id, module_id")
        .in("module_id", moduleIds);
      lessons = (lessonsData ?? []) as LessonRow[];
    }

    const courseByModule = new Map(modules.map((m) => [m.id, m.course_id]));
    for (const lesson of lessons) {
      const courseId = courseByModule.get(lesson.module_id);
      if (!courseId) continue;
      lessonCountByCourse.set(
        courseId,
        (lessonCountByCourse.get(courseId) ?? 0) + 1,
      );
      const list = lessonIdsByCourse.get(courseId) ?? [];
      list.push(lesson.id);
      lessonIdsByCourse.set(courseId, list);
    }
  }

  const allLessonIds = Array.from(lessonIdsByCourse.values()).flat();
  const completedByCourse = new Map<string, number>();

  if (allLessonIds.length > 0) {
    const { data: progressData } = await supabase
      .schema("membros")
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", user.id)
      .eq("is_completed", true)
      .in("lesson_id", allLessonIds);

    const completedSet = new Set(
      (progressData ?? []).map((r: { lesson_id: string }) => r.lesson_id),
    );
    Array.from(lessonIdsByCourse.entries()).forEach(([courseId, lessonIds]) => {
      const completed = lessonIds.filter((id) => completedSet.has(id)).length;
      completedByCourse.set(courseId, completed);
    });
  }

  // Últimas N visualizações do aluno → mapa "última aula com vídeo por curso"
  // + a aula global mais recente (pra "Continue de onde parou")
  const lastLessonByCourse = new Map<
    string,
    { lessonId: string; lessonTitle: string }
  >();
  let continueLesson: {
    lessonId: string;
    lessonTitle: string;
    courseTitle: string;
    courseId: string;
    coverUrl: string | null;
  } | null = null;

  const { data: viewsData } = await supabase
    .schema("membros")
    .from("access_logs")
    .select("lesson_id, created_at")
    .eq("user_id", user.id)
    .eq("action", "lesson_view")
    .not("lesson_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const views = (viewsData ?? []) as Array<{
    lesson_id: string;
    created_at: string;
  }>;

  if (views.length > 0) {
    const viewedLessonIds = Array.from(
      new Set(views.map((v) => v.lesson_id)),
    );
    const { data: lessonsData } = await supabase
      .schema("membros")
      .from("lessons")
      .select(
        "id, title, module_id, youtube_video_id, modules(course_id)",
      )
      .in("id", viewedLessonIds)
      .not("youtube_video_id", "is", null);

    const lessonInfoById = new Map<
      string,
      { title: string; courseId: string }
    >();
    for (const row of (lessonsData ?? []) as unknown as LessonWithCourseRow[]) {
      const mod = Array.isArray(row.modules) ? row.modules[0] : row.modules;
      const courseId = mod?.course_id;
      if (!courseId) continue;
      lessonInfoById.set(row.id, { title: row.title, courseId });
    }

    // Percorre views em ordem (mais recente → mais antiga); pega o primeiro hit
    // global e a primeira aula vista de cada curso.
    for (const view of views) {
      const info = lessonInfoById.get(view.lesson_id);
      if (!info) continue;
      if (!ownedSet.has(info.courseId)) continue;

      if (!lastLessonByCourse.has(info.courseId)) {
        lastLessonByCourse.set(info.courseId, {
          lessonId: view.lesson_id,
          lessonTitle: info.title,
        });
      }

      if (!continueLesson) {
        const course = ownedCourses.find((c) => c.id === info.courseId);
        if (course) {
          continueLesson = {
            lessonId: view.lesson_id,
            lessonTitle: info.title,
            courseId: course.id,
            courseTitle: course.title,
            coverUrl: course.cover_url,
          };
        }
      }
    }
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <header>
        <div className="mb-3 inline-block rounded-md bg-npb-gold px-3.5 py-1 text-xs font-bold text-black">
          Início
        </div>
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          Bem-vindo{firstName ? `, ${firstName}` : ""}!
        </h1>
        <p className="mt-1 text-sm text-npb-text-muted">
          Continue sua jornada na Academia NPB.
        </p>
      </header>

      {continueLesson && (
        <ContinueWatchingCard
          lessonId={continueLesson.lessonId}
          lessonTitle={continueLesson.lessonTitle}
          courseTitle={continueLesson.courseTitle}
          coverUrl={continueLesson.coverUrl}
        />
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-npb-text">
          Meus cursos
        </h2>
        {ownedCourses.length === 0 ? (
          <EmptyState
            title="Você ainda não tem cursos."
            description="Assim que sua matrícula for ativada, os cursos aparecem aqui."
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {ownedCourses.map((course) => {
              const total = lessonCountByCourse.get(course.id) ?? 0;
              const done = completedByCourse.get(course.id) ?? 0;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const resume = lastLessonByCourse.get(course.id) ?? null;
              return (
                <OwnedCourseCard
                  key={course.id}
                  courseId={course.id}
                  title={course.title}
                  coverUrl={course.cover_url}
                  totalLessons={total}
                  completedLessons={done}
                  progress={pct}
                  resumeLessonId={resume?.lessonId ?? null}
                />
              );
            })}
          </div>
        )}
      </section>

      {availableCourses.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-npb-text">
            Cursos disponíveis
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {availableCourses.map((course) => (
              <SaleCourseCard
                key={course.id}
                title={course.title}
                coverUrl={course.cover_url}
                saleUrl={course.sale_url}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ContinueWatchingCard({
  lessonId,
  lessonTitle,
  courseTitle,
  coverUrl,
}: {
  lessonId: string;
  lessonTitle: string;
  courseTitle: string;
  coverUrl: string | null;
}) {
  return (
    <Link
      href={`/lessons/${lessonId}`}
      className="group flex items-center gap-4 overflow-hidden rounded-2xl border border-npb-border bg-npb-bg2 p-4 transition hover:border-npb-gold/60 hover:shadow-npb-card-hover"
    >
      <div className="relative h-24 aspect-[5/7] flex-shrink-0 overflow-hidden rounded-lg bg-npb-bg3 sm:h-28">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-npb-curso-hero" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-90 transition group-hover:bg-black/30">
          <Play className="h-8 w-8 fill-npb-gold text-npb-gold" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-npb-gold">
          Continue de onde parou
        </p>
        <h3 className="mt-1 truncate text-base font-semibold text-npb-text">
          {lessonTitle}
        </h3>
        <p className="truncate text-sm text-npb-text-muted">{courseTitle}</p>
      </div>
    </Link>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-npb-border bg-npb-bg2/50 p-8 text-center">
      <p className="text-sm font-semibold text-npb-text">{title}</p>
      <p className="mt-1 text-sm text-npb-text-muted">{description}</p>
    </div>
  );
}
