import Link from "next/link";
import { ChevronRight, NotebookPen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface NoteRow {
  id: string;
  lesson_id: string;
  content: string;
  updated_at: string;
  lessons:
    | {
        id: string;
        title: string;
        modules:
          | {
              title: string;
              courses:
                | { id: string; title: string }
                | { id: string; title: string }[]
                | null;
            }
          | {
              title: string;
              courses:
                | { id: string; title: string }
                | { id: string; title: string }[]
                | null;
            }[]
          | null;
      }
    | null;
}

export default async function NotesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rawNotes } = await supabase
    .schema("membros")
    .from("lesson_notes")
    .select(
      "id, lesson_id, content, updated_at, lessons(id, title, modules(title, courses(id, title)))",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const notes = ((rawNotes ?? []) as unknown as NoteRow[])
    .map((n) => normalize(n))
    .filter((n): n is NonNullable<ReturnType<typeof normalize>> => n !== null);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <div className="mb-3 inline-block rounded-md bg-npb-gold px-3.5 py-1 text-xs font-bold text-black">
          Anotações
        </div>
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          Suas anotações
        </h1>
        <p className="mt-1 text-sm text-npb-text-muted">
          Tudo que você escreveu na aba &quot;Anotações&quot; das aulas. Clique
          pra abrir a aula correspondente.
        </p>
      </header>

      {notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-10 text-center">
          <NotebookPen className="mx-auto h-10 w-10 text-npb-gold" />
          <p className="mt-4 text-sm font-semibold text-npb-text">
            Você ainda não tem anotações.
          </p>
          <p className="mt-1 text-sm text-npb-text-muted">
            Dentro de uma aula, vá na aba &quot;Anotações&quot; pra escrever a
            primeira.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id}>
              <Link
                href={`/lessons/${n.lessonId}`}
                className="group block rounded-xl border border-npb-border bg-npb-bg2 p-5 transition hover:border-npb-gold/60 hover:shadow-npb-card-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-npb-gold">
                      {n.courseTitle}
                    </p>
                    <h3 className="mt-0.5 truncate text-base font-semibold text-npb-text group-hover:text-npb-gold">
                      {n.lessonTitle}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-npb-text-muted">
                      {n.moduleTitle}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-npb-text-muted transition group-hover:text-npb-gold" />
                </div>
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-npb-text">
                  {n.content}
                </p>
                <p className="mt-3 text-[11px] text-npb-text-muted">
                  Atualizada em{" "}
                  {new Date(n.updatedAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function normalize(n: NoteRow) {
  if (!n.lessons) return null;
  const mod = Array.isArray(n.lessons.modules)
    ? n.lessons.modules[0]
    : n.lessons.modules;
  if (!mod) return null;
  const course = Array.isArray(mod.courses) ? mod.courses[0] : mod.courses;
  if (!course) return null;

  return {
    id: n.id,
    lessonId: n.lesson_id,
    lessonTitle: n.lessons.title,
    moduleTitle: mod.title,
    courseTitle: course.title,
    content: n.content,
    updatedAt: n.updated_at,
  };
}
