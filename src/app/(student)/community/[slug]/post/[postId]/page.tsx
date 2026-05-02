import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/access";
import { sanitizePostHtml, timeAgoPtBr, videoEmbedUrl } from "@/lib/community";
import { Avatar } from "@/components/community/post-card";
import {
  CommentThread,
  type CommentNode,
} from "@/components/community/comment-thread";
import { TopicLikeButton } from "@/components/community/topic-like-button";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({
  params,
}: {
  params: { slug: string; postId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role = await getUserRole(supabase, user.id);
  const adminSupabase = createAdminClient();

  // Profile do user atual — usado pra optimistic UI no CommentThread
  const { data: currentProfile } = await supabase
    .schema("membros")
    .from("users")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const currentUserProfile = currentProfile as
    | { full_name: string | null; avatar_url: string | null }
    | null;

  const { data: topic } = await supabase
    .schema("membros")
    .from("community_topics")
    .select(
      "id, page_id, user_id, title, content_html, video_url, image_url, likes_count, replies_count, status, created_at",
    )
    .eq("id", params.postId)
    .maybeSingle();

  if (!topic) notFound();

  const t = topic as {
    id: string;
    page_id: string;
    user_id: string;
    title: string;
    content_html: string | null;
    video_url: string | null;
    image_url: string | null;
    likes_count: number;
    replies_count: number;
    status: string;
    created_at: string;
  };

  // RLS já filtra: só vê se aprovado, autor, ou admin
  if (
    t.status !== "approved" &&
    t.user_id !== user.id &&
    role !== "admin" &&
    role !== "moderator"
  ) {
    notFound();
  }

  const { data: page } = await supabase
    .schema("membros")
    .from("community_pages")
    .select("title, slug")
    .eq("id", t.page_id)
    .maybeSingle();

  const { data: authorRow } = await adminSupabase
    .schema("membros")
    .from("users")
    .select("id, full_name, avatar_url, role")
    .eq("id", t.user_id)
    .maybeSingle();
  const author = authorRow as
    | {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
        role: string;
      }
    | null;

  // Comentários (todos, root + replies)
  const { data: repliesData } = await supabase
    .schema("membros")
    .from("community_replies")
    .select(
      "id, user_id, parent_id, content_html, likes_count, created_at",
    )
    .eq("topic_id", t.id)
    .order("created_at", { ascending: true });

  const replies = (repliesData ?? []) as Array<{
    id: string;
    user_id: string;
    parent_id: string | null;
    content_html: string;
    likes_count: number;
    created_at: string;
  }>;

  // Hidrata autores das respostas
  const replyUserIds = Array.from(new Set(replies.map((r) => r.user_id)));
  const replyAuthors = new Map<
    string,
    { id: string; full_name: string | null; avatar_url: string | null }
  >();
  if (replyUserIds.length > 0) {
    const { data: users } = await adminSupabase
      .schema("membros")
      .from("users")
      .select("id, full_name, avatar_url")
      .in("id", replyUserIds);
    for (const u of (users ?? []) as Array<{
      id: string;
      full_name: string | null;
      avatar_url: string | null;
    }>) {
      replyAuthors.set(u.id, u);
    }
  }

  // Likes do user (no topic + nas replies)
  const { data: likedTopic } = await supabase
    .schema("membros")
    .from("community_likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("topic_id", t.id)
    .maybeSingle();

  const replyIds = replies.map((r) => r.id);
  const likedReplyIds = new Set<string>();
  if (replyIds.length > 0) {
    const { data: likedRows } = await supabase
      .schema("membros")
      .from("community_likes")
      .select("reply_id")
      .eq("user_id", user.id)
      .in("reply_id", replyIds);
    for (const l of (likedRows ?? []) as Array<{ reply_id: string | null }>) {
      if (l.reply_id) likedReplyIds.add(l.reply_id);
    }
  }

  // Monta árvore (1 nível) de comments
  const rootNodes: CommentNode[] = [];
  const byParent = new Map<string, CommentNode[]>();
  for (const r of replies) {
    const a = replyAuthors.get(r.user_id);
    const node: CommentNode = {
      id: r.id,
      authorId: r.user_id,
      authorName: a?.full_name ?? "Aluno",
      authorAvatarUrl: a?.avatar_url ?? null,
      contentHtml: r.content_html,
      likesCount: r.likes_count,
      createdAt: r.created_at,
      liked: likedReplyIds.has(r.id),
      parentId: r.parent_id,
      replies: [],
    };
    if (r.parent_id) {
      const arr = byParent.get(r.parent_id) ?? [];
      arr.push(node);
      byParent.set(r.parent_id, arr);
    } else {
      rootNodes.push(node);
    }
  }
  for (const root of rootNodes) {
    root.replies = byParent.get(root.id) ?? [];
  }

  const embed = videoEmbedUrl(t.video_url);
  const safeBody = t.content_html ? sanitizePostHtml(t.content_html) : "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/community/${page?.slug ?? params.slug}`}
        className="inline-flex items-center gap-1 text-sm text-npb-text-muted hover:text-npb-gold"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar para {page?.title ?? "espaço"}
      </Link>

      <article className="space-y-4 rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <header className="flex items-start gap-3">
          <Avatar
            src={author?.avatar_url ?? null}
            name={author?.full_name ?? "Aluno"}
            className="h-10 w-10"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-semibold text-npb-text">
                {author?.full_name ?? "Aluno"}
              </span>
              {(author?.role === "admin" || author?.role === "moderator") && (
                <span className="rounded bg-npb-gold/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-npb-gold">
                  {author.role === "admin" ? "Admin" : "Moderador"}
                </span>
              )}
              <span className="text-xs text-npb-text-muted">
                {timeAgoPtBr(t.created_at)}
              </span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-npb-text md:text-2xl">
              {t.title}
            </h1>
            {t.status !== "approved" && (
              <span className="mt-1 inline-block rounded bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-yellow-400">
                {t.status === "rejected" ? "Rejeitado" : "Aguardando aprovação"}
              </span>
            )}
          </div>
        </header>

        {safeBody && (
          <div
            className="community-html text-[15px] text-npb-text"
            dangerouslySetInnerHTML={{ __html: safeBody }}
          />
        )}

        {embed && (
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-npb-border bg-black">
            <iframe
              src={embed}
              title={t.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        )}

        {t.image_url && !embed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.image_url}
            alt={t.title}
            className="w-full rounded-lg border border-npb-border object-contain"
          />
        )}

        <div className="flex items-center gap-4 border-t border-npb-border pt-4 text-xs">
          <TopicLikeButton
            topicId={t.id}
            initialLiked={Boolean(likedTopic)}
            initialCount={t.likes_count}
          />
          <span className="inline-flex items-center gap-1.5 text-npb-text-muted">
            💬 {replies.length}{" "}
            {replies.length === 1 ? "comentário" : "comentários"}
          </span>
        </div>
      </article>

      <section className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <h2 className="mb-4 text-base font-bold text-npb-text">Comentários</h2>
        <CommentThread
          topicId={t.id}
          rootNodes={rootNodes}
          currentUserId={user.id}
          currentUserName={currentUserProfile?.full_name ?? "Você"}
          currentUserAvatarUrl={currentUserProfile?.avatar_url ?? null}
          currentRole={role}
        />
      </section>
    </div>
  );
}
