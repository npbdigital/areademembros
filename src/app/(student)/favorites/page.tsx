import Link from "next/link";
import { Bookmark, Clock, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface FavoriteRow {
  lesson_id: string;
  created_at: string;
  lessons:
    | {
        id: string;
        title: string;
        duration_seconds: number | null;
        youtube_video_id: string | null;
        modules:
          | {
              title: string;
              courses:
                | { id: string; title: string; cover_url: string | null }
                | { id: string; title: string; cover_url: string | null }[]
                | null;
            }
          | {
              title: string;
              courses:
                | { id: string; title: string; cover_url: string | null }
                | { id: string; title: string; cover_url: string | null }[]
                | null;
            }[]
          | null;
      }
    | null;
}

export default async function FavoritesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rawFavorites } = await supabase
    .schema("membros")
    .from("lesson_favorites")
    .select(
      "lesson_id, created_at, lessons(id, title, duration_seconds, youtube_video_id, modules(title, courses(id, title, cover_url)))",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const favorites = ((rawFavorites ?? []) as unknown as FavoriteRow[])
    .map((f) => normalizeFavorite(f))
    .filter((f): f is NonNullable<ReturnType<typeof normalizeFavorite>> => f !== null);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <div className="mb-3 inline-block rounded-md bg-npb-gold px-3.5 py-1 text-xs font-bold text-black">
          Favoritos
        </div>
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          Suas aulas salvas
        </h1>
        <p className="mt-1 text-sm text-npb-text-muted">
          Tudo que você marcou no botão &quot;Salvar nos favoritos&quot; aparece
          aqui.
        </p>
      </header>

      {favorites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-10 text-center">
          <Bookmark className="mx-auto h-10 w-10 text-npb-gold" />
          <p className="mt-4 text-sm font-semibold text-npb-text">
            Você ainda não salvou nenhuma aula.
          </p>
          <p className="mt-1 text-sm text-npb-text-muted">
            Dentro de qualquer aula, clique em &quot;Salvar nos favoritos&quot;
            pra ela aparecer aqui.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {favorites.map((f) => (
            <li key={f.lessonId}>
              <Link
                href={`/lessons/${f.lessonId}`}
                className="group flex items-center gap-4 rounded-xl border border-npb-border bg-npb-bg2 p-4 transition hover:border-npb-gold/60 hover:shadow-npb-card-hover"
              >
                <div className="relative h-20 aspect-[5/7] flex-shrink-0 overflow-hidden rounded-lg bg-npb-bg3">
                  {f.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.coverUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-npb-curso-hero" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-90 transition group-hover:bg-black/30">
                    <PlayCircle className="h-7 w-7 text-npb-gold" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-npb-gold">
                    {f.courseTitle}
                  </p>
                  <h3 className="mt-0.5 truncate text-base font-semibold text-npb-text group-hover:text-npb-gold">
                    {f.lessonTitle}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-npb-text-muted">
                    {f.moduleTitle}
                    {f.duration ? ` · ${f.duration}` : ""}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1 text-[11px] text-npb-text-muted">
                  <Clock className="h-3 w-3" />
                  {formatRelativeDate(f.savedAt)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function normalizeFavorite(f: FavoriteRow) {
  if (!f.lessons) return null;
  const mod = Array.isArray(f.lessons.modules)
    ? f.lessons.modules[0]
    : f.lessons.modules;
  if (!mod) return null;
  const course = Array.isArray(mod.courses) ? mod.courses[0] : mod.courses;
  if (!course) return null;

  return {
    lessonId: f.lessons.id,
    lessonTitle: f.lessons.title,
    moduleTitle: mod.title,
    courseTitle: course.title,
    coverUrl: course.cover_url,
    duration: formatDuration(f.lessons.duration_seconds),
    savedAt: f.created_at,
  };
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds < 1) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}min`;
  return `${m}min`;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return "hoje";
  if (diffDays < 2) return "ontem";
  if (diffDays < 7) return `${diffDays}d atrás`;
  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
}
