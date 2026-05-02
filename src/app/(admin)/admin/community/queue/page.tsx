import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { ModerationActions } from "@/components/admin/community/moderation-actions";
import { timeAgoPtBr } from "@/lib/community";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 5;

export default async function CommunityQueuePage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const supabase = createAdminClient();
  const pageNum = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: pending, count } = await supabase
    .schema("membros")
    .from("community_topics")
    .select(
      "id, page_id, user_id, title, content_html, video_url, image_url, created_at",
      { count: "exact" },
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .range(from, to);

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(pageNum, totalPages);
  const hasPrev = safePage > 1;
  const hasNext = safePage < totalPages;

  const items = (pending ?? []) as Array<{
    id: string;
    page_id: string;
    user_id: string;
    title: string;
    content_html: string | null;
    video_url: string | null;
    image_url: string | null;
    created_at: string;
  }>;

  const userIds = Array.from(new Set(items.map((i) => i.user_id)));
  const pageIds = Array.from(new Set(items.map((i) => i.page_id)));

  const [{ data: users }, { data: pages }] = await Promise.all([
    userIds.length > 0
      ? supabase
          .schema("membros")
          .from("users")
          .select("id, full_name, email")
          .in("id", userIds)
      : Promise.resolve({ data: [] as Array<unknown> }),
    pageIds.length > 0
      ? supabase
          .schema("membros")
          .from("community_pages")
          .select("id, title, slug")
          .in("id", pageIds)
      : Promise.resolve({ data: [] as Array<unknown> }),
  ]);

  const userMap = new Map(
    ((users ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string;
    }>).map((u) => [u.id, u]),
  );
  const pageMap = new Map(
    ((pages ?? []) as Array<{
      id: string;
      title: string;
      slug: string | null;
    }>).map((p) => [p.id, p]),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/admin/community"
          className="inline-flex items-center gap-1 text-sm text-npb-text-muted hover:text-npb-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>
        <h1 className="mt-3 text-xl font-bold text-npb-text">
          Fila de moderação
        </h1>
        <p className="text-sm text-npb-text-muted">
          {totalCount === 0
            ? "Nada aguardando aprovação. 🎉"
            : `${totalCount} publicação${totalCount > 1 ? "ões" : ""} pendente${totalCount > 1 ? "s" : ""} · página ${safePage} de ${totalPages}`}
        </p>
      </div>

      {totalCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-10 text-center text-sm text-npb-text-muted">
          Quando os alunos publicarem, as postagens aparecerão aqui.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => {
            const author = userMap.get(it.user_id);
            const page = pageMap.get(it.page_id);
            const previewBody = stripHtml(it.content_html ?? "").slice(0, 280);
            return (
              <li
                key={it.id}
                className="rounded-xl border border-npb-border bg-npb-bg2 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-npb-text-muted">
                  <span>
                    <strong className="text-npb-text">
                      {author?.full_name || author?.email || "Aluno"}
                    </strong>{" "}
                    em <strong className="text-npb-gold">{page?.title ?? "—"}</strong>
                  </span>
                  <span>{timeAgoPtBr(it.created_at)}</span>
                </div>
                <h3 className="mt-1 text-base font-semibold text-npb-text">
                  {it.title}
                </h3>
                {previewBody && (
                  <p className="mt-1 text-sm text-npb-text-muted line-clamp-3">
                    {previewBody}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-npb-text-muted">
                  {it.video_url && (
                    <a
                      href={it.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-npb-gold"
                    >
                      <ExternalLink className="h-3 w-3" /> Ver vídeo
                    </a>
                  )}
                  {it.image_url && (
                    <a
                      href={it.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-npb-gold"
                    >
                      <ExternalLink className="h-3 w-3" /> Ver imagem
                    </a>
                  )}
                  {page?.slug && (
                    <Link
                      href={`/community/${page.slug}/post/${it.id}`}
                      className="inline-flex items-center gap-1 hover:text-npb-gold"
                    >
                      <ExternalLink className="h-3 w-3" /> Ver completo
                    </Link>
                  )}
                </div>
                <div className="mt-3 flex justify-end">
                  <ModerationActions topicId={it.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <Link
            href={
              hasPrev
                ? `/admin/community/queue?page=${safePage - 1}`
                : "/admin/community/queue"
            }
            aria-disabled={!hasPrev}
            className={`inline-flex items-center gap-1 rounded-md border border-npb-border px-3 py-1.5 text-xs font-semibold ${
              hasPrev
                ? "text-npb-text hover:border-npb-gold hover:text-npb-gold"
                : "pointer-events-none text-npb-text-muted opacity-40"
            }`}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Anterior
          </Link>
          <span className="text-xs text-npb-text-muted">
            {safePage} / {totalPages}
          </span>
          <Link
            href={
              hasNext
                ? `/admin/community/queue?page=${safePage + 1}`
                : `/admin/community/queue?page=${safePage}`
            }
            aria-disabled={!hasNext}
            className={`inline-flex items-center gap-1 rounded-md border border-npb-border px-3 py-1.5 text-xs font-semibold ${
              hasNext
                ? "text-npb-text hover:border-npb-gold hover:text-npb-gold"
                : "pointer-events-none text-npb-text-muted opacity-40"
            }`}
          >
            Próxima
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
