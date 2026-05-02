import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { ModerationActions } from "@/components/admin/community/moderation-actions";
import { timeAgoPtBr } from "@/lib/community";

export const dynamic = "force-dynamic";

export default async function CommunityQueuePage() {
  const supabase = createAdminClient();

  const { data: pending } = await supabase
    .schema("membros")
    .from("community_topics")
    .select(
      "id, gallery_id, user_id, title, content_html, video_url, image_url, created_at",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const items = (pending ?? []) as Array<{
    id: string;
    gallery_id: string;
    user_id: string;
    title: string;
    content_html: string | null;
    video_url: string | null;
    image_url: string | null;
    created_at: string;
  }>;

  const userIds = Array.from(new Set(items.map((i) => i.user_id)));
  const galleryIds = Array.from(new Set(items.map((i) => i.gallery_id)));

  const [{ data: users }, { data: galleries }] = await Promise.all([
    userIds.length > 0
      ? supabase
          .schema("membros")
          .from("users")
          .select("id, full_name, email")
          .in("id", userIds)
      : Promise.resolve({ data: [] as Array<unknown> }),
    galleryIds.length > 0
      ? supabase
          .schema("membros")
          .from("community_galleries")
          .select("id, title, slug")
          .in("id", galleryIds)
      : Promise.resolve({ data: [] as Array<unknown> }),
  ]);

  const userMap = new Map(
    ((users ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string;
    }>).map((u) => [u.id, u]),
  );
  const galleryMap = new Map(
    ((galleries ?? []) as Array<{
      id: string;
      title: string;
      slug: string | null;
    }>).map((g) => [g.id, g]),
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
          {items.length === 0
            ? "Nada aguardando aprovação. 🎉"
            : `${items.length} publicação${items.length > 1 ? "ões" : ""} pendente${items.length > 1 ? "s" : ""}.`}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-10 text-center text-sm text-npb-text-muted">
          Quando os alunos publicarem, as postagens aparecerão aqui.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => {
            const author = userMap.get(it.user_id);
            const gallery = galleryMap.get(it.gallery_id);
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
                    em <strong className="text-npb-gold">{gallery?.title ?? "—"}</strong>
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
                  {gallery?.slug && (
                    <Link
                      href={`/community/${gallery.slug}/post/${it.id}`}
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
    </div>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
