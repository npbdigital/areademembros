import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  GalleryHorizontal,
  ImageIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface BannerRow {
  id: string;
  course_id: string;
  image_url: string;
  link_url: string | null;
  link_target: string | null;
  is_active: boolean;
  position: number;
}

export default async function AdminBannersPage() {
  const supabase = createClient();

  const { data: bannersData } = await supabase
    .schema("membros")
    .from("banners")
    .select("id, course_id, image_url, link_url, link_target, is_active, position")
    .order("position", { ascending: true });

  const banners = (bannersData ?? []) as BannerRow[];

  const courseIds = Array.from(new Set(banners.map((b) => b.course_id)));
  const { data: coursesData } = courseIds.length
    ? await supabase
        .schema("membros")
        .from("courses")
        .select("id, title, cover_url, is_published")
        .in("id", courseIds)
    : { data: [] };

  const courses = ((coursesData ?? []) as Array<{
    id: string;
    title: string;
    cover_url: string | null;
    is_published: boolean | null;
  }>).reduce(
    (map, c) => map.set(c.id, c),
    new Map<
      string,
      {
        id: string;
        title: string;
        cover_url: string | null;
        is_published: boolean | null;
      }
    >(),
  );

  const grouped = banners.reduce((map, b) => {
    const arr = map.get(b.course_id) ?? [];
    arr.push(b);
    map.set(b.course_id, arr);
    return map;
  }, new Map<string, BannerRow[]>());

  const groupsList = Array.from(grouped.entries())
    .map(([courseId, items]) => {
      const course = courses.get(courseId);
      return {
        courseId,
        courseTitle: course?.title ?? "(curso removido)",
        coursePublished: course?.is_published ?? false,
        banners: items.sort((a, b) => a.position - b.position),
      };
    })
    .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));

  const totalActive = banners.filter((b) => b.is_active).length;
  const totalInactive = banners.length - totalActive;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
          <GalleryHorizontal className="h-3.5 w-3.5" />
          Banners
        </div>
        <h1 className="text-2xl font-bold text-npb-text">
          Banners por curso
        </h1>
        <p className="mt-1 text-sm text-npb-text-muted">
          {banners.length === 0
            ? "Ainda não há banners cadastrados."
            : `${banners.length} banner${banners.length > 1 ? "s" : ""} no total — ${totalActive} ativo${totalActive === 1 ? "" : "s"}, ${totalInactive} inativo${totalInactive === 1 ? "" : "s"}.`}
        </p>
        <p className="mt-2 text-xs text-npb-text-muted">
          Banners são criados, reordenados e excluídos dentro da página do
          curso. Esta tela é só pra ter uma visão geral do que está publicado.
        </p>
      </header>

      {groupsList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 px-6 py-16 text-center">
          <GalleryHorizontal className="mx-auto h-10 w-10 text-npb-gold" />
          <p className="mt-4 text-sm font-semibold text-npb-text">
            Nenhum banner ainda.
          </p>
          <p className="mt-1 text-sm text-npb-text-muted">
            Vá em <Link href="/admin/courses" className="text-npb-gold hover:text-npb-gold-light">/admin/courses</Link>, abra um curso e adicione na seção &quot;Banners&quot;.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupsList.map((group) => (
            <section
              key={group.courseId}
              className="rounded-2xl border border-npb-border bg-npb-bg2 p-5"
            >
              <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-npb-text">
                    {group.courseTitle}
                  </h2>
                  <p className="text-[11px] text-npb-text-muted">
                    {group.banners.length} banner{group.banners.length > 1 ? "s" : ""}
                    {!group.coursePublished && " · curso não publicado"}
                  </p>
                </div>
                <Link
                  href={`/admin/courses/${group.courseId}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-xs font-semibold text-npb-text transition hover:border-npb-gold"
                >
                  Gerenciar
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </header>

              <ul className="space-y-2">
                {group.banners.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center gap-3 rounded-lg border border-npb-border bg-npb-bg3 p-3"
                  >
                    <div className="h-12 w-36 flex-shrink-0 overflow-hidden rounded bg-npb-bg4">
                      {b.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-npb-text-muted">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {b.link_url ? (
                        <p className="truncate text-xs text-npb-text-muted">
                          {b.link_url}
                        </p>
                      ) : (
                        <p className="text-xs italic text-npb-text-muted">
                          Sem link
                        </p>
                      )}
                      <p className="text-[10px] uppercase tracking-wide text-npb-text-muted">
                        {b.link_target === "_self" ? "Mesma aba" : "Nova aba"}
                      </p>
                    </div>
                    {b.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-2 py-1 text-[10px] font-semibold text-green-400">
                        <Eye className="h-3 w-3" />
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-npb-bg4 px-2 py-1 text-[10px] font-semibold text-npb-text-muted">
                        <EyeOff className="h-3 w-3" />
                        Inativo
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
