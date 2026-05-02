import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Lock,
  PlaySquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { checkCourseAccess } from "@/lib/access";
import {
  isContentReleased,
  releaseMessage,
  type DripConfig,
} from "@/lib/drip";
import { YouTubePlayer } from "@/components/student/youtube-player";
import { LessonActionsRow } from "@/components/student/lesson-actions-row";
import { LessonTabs, type AttachmentItem } from "@/components/student/lesson-tabs";

export const dynamic = "force-dynamic";

interface LessonRecord extends DripConfig {
  id: string;
  title: string;
  description_html: string | null;
  youtube_video_id: string | null;
  duration_seconds: number | null;
  position: number;
  module_id: string;
}

interface ModuleRecord extends DripConfig {
  id: string;
  title: string;
  course_id: string;
  position: number;
}

export default async function LessonPage({
  params,
}: {
  params: { lessonId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lessonData } = await supabase
    .schema("membros")
    .from("lessons")
    .select(
      "id, title, description_html, youtube_video_id, duration_seconds, position, module_id, release_type, release_days, release_date",
    )
    .eq("id", params.lessonId)
    .maybeSingle();

  const lesson = lessonData as LessonRecord | null;
  if (!lesson) notFound();

  const { data: moduleData } = await supabase
    .schema("membros")
    .from("modules")
    .select(
      "id, title, course_id, position, release_type, release_days, release_date",
    )
    .eq("id", lesson.module_id)
    .maybeSingle();

  const moduleRow = moduleData as ModuleRecord | null;
  if (!moduleRow) notFound();

  const { data: courseData } = await supabase
    .schema("membros")
    .from("courses")
    .select("id, title, is_published")
    .eq("id", moduleRow.course_id)
    .maybeSingle();

  if (!courseData || !courseData.is_published) notFound();

  const access = await checkCourseAccess(supabase, user.id, courseData.id);
  if (!access) {
    redirect(`/courses/${courseData.id}`);
  }

  const moduleStatus = isContentReleased(moduleRow, access.enrolled_at);
  const lessonStatus = isContentReleased(lesson, access.enrolled_at);

  if (!moduleStatus.released || !lessonStatus.released) {
    return (
      <LockedNotice
        courseId={courseData.id}
        message={
          !moduleStatus.released
            ? releaseMessage(moduleStatus)
            : releaseMessage(lessonStatus)
        }
      />
    );
  }

  const { data: siblingLessonsData } = await supabase
    .schema("membros")
    .from("lessons")
    .select(
      "id, title, position, duration_seconds, release_type, release_days, release_date",
    )
    .eq("module_id", lesson.module_id)
    .order("position", { ascending: true });

  type Sibling = LessonRecord;
  const siblings = (siblingLessonsData ?? []) as Sibling[];

  const idx = siblings.findIndex((s) => s.id === lesson.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const siblingIds = siblings.map((s) => s.id);
  const completedSet = new Set<string>();
  if (siblingIds.length > 0) {
    const { data: progress } = await supabase
      .schema("membros")
      .from("lesson_progress")
      .select("lesson_id, is_completed")
      .eq("user_id", user.id)
      .in("lesson_id", siblingIds);
    for (const row of progress ?? []) {
      const r = row as { lesson_id: string; is_completed: boolean };
      if (r.is_completed) completedSet.add(r.lesson_id);
    }
  }

  const [
    { data: thisProgress },
    { data: thisFavorite },
    { data: thisNote },
    { data: thisRating },
    { data: attachmentsData },
  ] = await Promise.all([
    supabase
      .schema("membros")
      .from("lesson_progress")
      .select("is_completed, last_position_seconds")
      .eq("user_id", user.id)
      .eq("lesson_id", lesson.id)
      .maybeSingle(),
    supabase
      .schema("membros")
      .from("lesson_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("lesson_id", lesson.id)
      .maybeSingle(),
    supabase
      .schema("membros")
      .from("lesson_notes")
      .select("content")
      .eq("user_id", user.id)
      .eq("lesson_id", lesson.id)
      .maybeSingle(),
    supabase
      .schema("membros")
      .from("lesson_ratings")
      .select("rating, comment")
      .eq("user_id", user.id)
      .eq("lesson_id", lesson.id)
      .maybeSingle(),
    supabase
      .schema("membros")
      .from("lesson_attachments")
      .select("id, file_name, file_url, file_size_bytes")
      .eq("lesson_id", lesson.id)
      .order("position", { ascending: true }),
  ]);

  const progressRow = thisProgress as
    | { is_completed?: boolean; last_position_seconds?: number | null }
    | null;
  const isCompleted = Boolean(progressRow?.is_completed);
  const initialPositionSeconds = Math.max(
    0,
    Math.floor(progressRow?.last_position_seconds ?? 0),
  );
  const isFavorite = Boolean(thisFavorite);
  const noteContent = (thisNote as { content?: string } | null)?.content ?? "";
  const ratingRow = thisRating as
    | { rating: number; comment: string | null }
    | null;
  const attachments: AttachmentItem[] = (
    (attachmentsData ?? []) as Array<{
      id: string;
      file_name: string;
      file_url: string;
      file_size_bytes: number | null;
    }>
  ).map((a) => ({
    id: a.id,
    fileName: a.file_name,
    fileUrl: a.file_url,
    fileSizeBytes: a.file_size_bytes,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link
        href={`/courses/${courseData.id}`}
        className="inline-flex items-center gap-1 text-sm text-npb-text-muted transition hover:text-npb-gold"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar para os módulos
      </Link>

      <Breadcrumb
        courseId={courseData.id}
        courseTitle={courseData.title}
        moduleTitle={moduleRow.title}
        lessonTitle={lesson.title}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {lesson.youtube_video_id && (
            <YouTubePlayer
              lessonId={lesson.id}
              videoId={lesson.youtube_video_id}
              initialPositionSeconds={initialPositionSeconds}
            />
          )}

          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-npb-gold">
                  {moduleRow.title}
                </p>
                <h1 className="mt-1 text-xl font-bold text-npb-text md:text-2xl">
                  {lesson.title}
                </h1>
                {lesson.duration_seconds ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-npb-text-muted">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(lesson.duration_seconds)}
                  </p>
                ) : null}
              </div>
              <NavButtons prev={prev} next={next} />
            </div>

            <LessonActionsRow
              lessonId={lesson.id}
              initialCompleted={isCompleted}
              initialFavorite={isFavorite}
            />
          </div>

          <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
            <LessonTabs
              lessonId={lesson.id}
              descriptionHtml={lesson.description_html}
              attachments={attachments}
              initialNote={noteContent}
              initialRating={ratingRow?.rating ?? null}
              initialComment={ratingRow?.comment ?? null}
            />
          </div>
        </div>

        <aside className="rounded-2xl border border-npb-border bg-npb-bg2 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-npb-text-muted">
            Aulas do módulo
          </h2>
          <div className="max-h-[70vh] space-y-1 overflow-y-auto npb-scrollbar pr-1">
            {siblings.map((s) => {
              const sStatus = isContentReleased(s, access.enrolled_at);
              const isCurrent = s.id === lesson.id;
              const isDone = completedSet.has(s.id);
              const locked = !sStatus.released;

              const content = (
                <div
                  className={`flex items-start gap-3 rounded-lg p-3 transition ${
                    isCurrent
                      ? "bg-npb-gold/15 ring-1 ring-npb-gold/40"
                      : locked
                        ? "opacity-60"
                        : "hover:bg-npb-bg3"
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {locked ? (
                      <Lock className="h-4 w-4 text-npb-text-muted" />
                    ) : isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-npb-gold" />
                    ) : (
                      <PlaySquare className="h-4 w-4 text-npb-text-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm leading-tight ${
                        isCurrent
                          ? "font-semibold text-npb-text"
                          : "text-npb-text"
                      }`}
                    >
                      {s.title}
                    </p>
                    {locked ? (
                      <p className="mt-0.5 text-xs text-npb-text-muted">
                        {releaseMessage(sStatus)}
                      </p>
                    ) : s.duration_seconds ? (
                      <p className="mt-0.5 text-xs text-npb-text-muted">
                        {formatDuration(s.duration_seconds)}
                      </p>
                    ) : null}
                  </div>
                </div>
              );

              return locked || isCurrent ? (
                <div key={s.id}>{content}</div>
              ) : (
                <Link key={s.id} href={`/lessons/${s.id}`}>
                  {content}
                </Link>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Breadcrumb({
  courseId,
  courseTitle,
  moduleTitle,
  lessonTitle,
}: {
  courseId: string;
  courseTitle: string;
  moduleTitle: string;
  lessonTitle: string;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-xs text-npb-text-muted">
      <Link href="/dashboard" className="hover:text-npb-gold">
        Biblioteca
      </Link>
      <span>/</span>
      <Link href={`/courses/${courseId}`} className="hover:text-npb-gold">
        {courseTitle}
      </Link>
      <span>/</span>
      <Link href={`/courses/${courseId}`} className="hover:text-npb-gold">
        {moduleTitle}
      </Link>
      <span>/</span>
      <span className="text-npb-text">{lessonTitle}</span>
    </nav>
  );
}

function NavButtons({
  prev,
  next,
}: {
  prev: { id: string } | null;
  next: { id: string } | null;
}) {
  return (
    <div className="flex gap-2">
      {prev ? (
        <Link
          href={`/lessons/${prev.id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-npb-border bg-npb-bg2 px-3 py-1.5 text-xs font-semibold text-npb-text transition hover:border-npb-gold"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Link>
      ) : null}
      {next ? (
        <Link
          href={`/lessons/${next.id}`}
          className="inline-flex items-center gap-1 rounded-lg bg-npb-gold px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-npb-gold-light"
        >
          Próxima
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

function LockedNotice({
  courseId,
  message,
}: {
  courseId: string;
  message: string;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-8 text-center">
        <Lock className="mx-auto h-10 w-10 text-npb-gold" />
        <h1 className="mt-4 text-xl font-bold text-npb-text">
          Aula bloqueada
        </h1>
        <p className="mt-2 text-sm text-npb-text-muted">{message}</p>
        <Link
          href={`/courses/${courseId}`}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-npb-border bg-npb-bg3 px-4 py-2 text-sm font-semibold text-npb-text transition hover:border-npb-gold"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar ao curso
        </Link>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, "0")}min`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}
