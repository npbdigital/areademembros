import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Lock, PlayCircle, PlaySquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { checkCourseAccess, isElevatedRole, getUserRole } from "@/lib/access";
import {
  isContentReleased,
  releaseMessage,
  type DripConfig,
} from "@/lib/drip";
import { BannerCarousel, type BannerItem } from "@/components/student/banner-carousel";
import {
  SortableModulesGrid,
  type AdminModuleCard,
} from "@/components/student/sortable-modules-grid";

export const dynamic = "force-dynamic";

interface ModuleRow extends DripConfig {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  position: number;
}

interface LessonRow {
  id: string;
  module_id: string;
  position: number;
}

interface BannerRow {
  id: string;
  image_url: string;
  link_url: string | null;
  link_target: string | null;
  position: number;
}

export default async function CoursePage({
  params,
}: {
  params: { courseId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: course } = await supabase
    .schema("membros")
    .from("courses")
    .select("id, title, description, cover_url, is_published")
    .eq("id", params.courseId)
    .maybeSingle();

  if (!course || !course.is_published) notFound();

  const role = await getUserRole(supabase, user.id);
  const isElevated = isElevatedRole(role);

  const access = await checkCourseAccess(supabase, user.id, course.id, role);
  if (!access) {
    return <NoAccessNotice courseTitle={course.title} />;
  }

  const { data: modulesData } = await supabase
    .schema("membros")
    .from("modules")
    .select(
      "id, title, description, cover_url, position, release_type, release_days, release_date",
    )
    .eq("course_id", course.id)
    .order("position", { ascending: true });

  const modules = (modulesData ?? []) as ModuleRow[];
  const moduleIds = modules.map((m) => m.id);

  let lessons: LessonRow[] = [];
  if (moduleIds.length > 0) {
    const { data } = await supabase
      .schema("membros")
      .from("lessons")
      .select("id, module_id, position")
      .in("module_id", moduleIds)
      .order("position", { ascending: true });
    lessons = (data ?? []) as LessonRow[];
  }

  const lessonsByModule = new Map<string, LessonRow[]>();
  for (const l of lessons) {
    const arr = lessonsByModule.get(l.module_id) ?? [];
    arr.push(l);
    lessonsByModule.set(l.module_id, arr);
  }

  const allLessonIds = lessons.map((l) => l.id);
  const completedSet = new Set<string>();
  let lastWatchedLessonId: string | null = null;
  if (allLessonIds.length > 0) {
    const { data: progress } = await supabase
      .schema("membros")
      .from("lesson_progress")
      .select("lesson_id, is_completed, last_watched_at")
      .eq("user_id", user.id)
      .in("lesson_id", allLessonIds);

    let mostRecent: { id: string; ts: number } | null = null;
    for (const raw of progress ?? []) {
      const p = raw as {
        lesson_id: string;
        is_completed: boolean | null;
        last_watched_at: string | null;
      };
      if (p.is_completed) completedSet.add(p.lesson_id);
      if (p.last_watched_at) {
        const ts = new Date(p.last_watched_at).getTime();
        if (!mostRecent || ts > mostRecent.ts) {
          mostRecent = { id: p.lesson_id, ts };
        }
      }
    }
    lastWatchedLessonId = mostRecent?.id ?? null;
  }
  // CTA "Continuar curso": quando há progresso, vai pra última aula vista.
  // Quando é primeiro acesso, abre a primeira aula do primeiro módulo.
  const ctaLessonId = lastWatchedLessonId ?? lessons[0]?.id ?? null;
  const ctaLabel = lastWatchedLessonId
    ? "Continuar de onde parou"
    : "Começar curso";

  const { data: bannersData } = await supabase
    .schema("membros")
    .from("banners")
    .select("id, image_url, link_url, link_target, position")
    .eq("course_id", course.id)
    .eq("is_active", true)
    .order("position", { ascending: true });

  const banners: BannerItem[] = ((bannersData ?? []) as BannerRow[]).map(
    (b) => ({
      id: b.id,
      imageUrl: b.image_url,
      linkUrl: b.link_url,
      linkTarget: b.link_target ?? "_blank",
    }),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-npb-text-muted transition hover:text-npb-gold"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar para a biblioteca
      </Link>

      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          {course.title}
        </h1>
        {course.description && (
          <p className="max-w-3xl text-sm leading-relaxed text-npb-text-muted">
            {course.description}
          </p>
        )}
        {ctaLessonId && (
          <div>
            <Link
              href={`/lessons/${ctaLessonId}`}
              className="inline-flex items-center gap-2 rounded-lg bg-npb-gold px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-npb-gold-light"
            >
              <PlayCircle className="h-4 w-4" />
              {ctaLabel}
            </Link>
          </div>
        )}
      </header>

      {banners.length > 0 && <BannerCarousel banners={banners} />}

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-npb-text">Módulos</h2>
          {isElevated && modules.length > 0 && (
            <span className="rounded bg-npb-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-npb-gold">
              Modo edição
            </span>
          )}
        </div>
        {modules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-npb-border bg-npb-bg2/50 p-8 text-center text-sm text-npb-text-muted">
            Esse curso ainda não tem módulos publicados.
          </div>
        ) : isElevated ? (
          <SortableModulesGrid
            courseId={course.id}
            modules={modules.map<AdminModuleCard>((m) => {
              const moduleLessons = lessonsByModule.get(m.id) ?? [];
              return {
                id: m.id,
                title: m.title,
                cover_url: m.cover_url,
                totalLessons: moduleLessons.length,
                firstLessonId: moduleLessons[0]?.id,
              };
            })}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {modules.map((module) => {
              const status = isContentReleased(module, access.enrolled_at);
              const moduleLessons = lessonsByModule.get(module.id) ?? [];
              const total = moduleLessons.length;
              const done = moduleLessons.filter((l) =>
                completedSet.has(l.id),
              ).length;
              const firstLesson = moduleLessons[0];

              return (
                <ModuleCard
                  key={module.id}
                  title={module.title}
                  coverUrl={module.cover_url}
                  totalLessons={total}
                  completedLessons={done}
                  locked={!status.released}
                  lockMessage={releaseMessage(status)}
                  firstLessonId={firstLesson?.id}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ModuleCard({
  title,
  coverUrl,
  totalLessons,
  completedLessons,
  locked,
  lockMessage,
  firstLessonId,
}: {
  title: string;
  coverUrl: string | null;
  totalLessons: number;
  completedLessons: number;
  locked: boolean;
  lockMessage: string;
  firstLessonId: string | undefined;
}) {
  const pct =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const inner = (
    <>
      <div className="relative aspect-[5/7] w-full overflow-hidden bg-npb-bg3">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wide text-npb-text-muted">
            Sem capa
          </div>
        )}
        {locked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center">
            <Lock className="h-8 w-8 text-npb-gold" />
            <span className="px-4 text-xs font-semibold text-npb-text">
              {lockMessage}
            </span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-npb-text">
          {title}
        </h3>
        <div className="mt-3 flex items-center justify-between text-xs text-npb-text-muted">
          <span className="inline-flex items-center gap-1">
            <PlaySquare className="h-3.5 w-3.5" />
            {totalLessons} {totalLessons === 1 ? "aula" : "aulas"}
          </span>
          {!locked && totalLessons > 0 && (
            <span className="font-semibold text-npb-gold">{pct}%</span>
          )}
        </div>
        {!locked && totalLessons > 0 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-npb-bg4">
            <div
              className="h-full bg-npb-gold-gradient"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
    </>
  );

  if (locked || !firstLessonId) {
    return (
      <div className="block overflow-hidden rounded-xl border border-npb-border bg-npb-bg2 opacity-80">
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={`/lessons/${firstLessonId}`}
      className="group block overflow-hidden rounded-xl border border-npb-border bg-npb-bg2 transition hover:border-npb-gold/60 hover:shadow-npb-card-hover"
    >
      {inner}
    </Link>
  );
}

function NoAccessNotice({ courseTitle }: { courseTitle: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-8 text-center">
        <Lock className="mx-auto h-10 w-10 text-npb-gold" />
        <h1 className="mt-4 text-xl font-bold text-npb-text">
          Você não tem acesso a {courseTitle}
        </h1>
        <p className="mt-2 text-sm text-npb-text-muted">
          Esse curso ainda não está liberado pra sua matrícula. Se acredita que
          deveria ter acesso, fale com o suporte.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-npb-border bg-npb-bg3 px-4 py-2 text-sm font-semibold text-npb-text transition hover:border-npb-gold"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar para a biblioteca
        </Link>
      </div>
    </div>
  );
}
