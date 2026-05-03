import { notFound } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/access";
import { PostCard, type PostCardData } from "@/components/community/post-card";
import { CreatePostButton } from "@/components/community/create-post-button";
import { RealtimeFeedRefresher } from "@/components/community/realtime-feed-refresher";
import { fetchAuthorMeta } from "@/lib/author-meta";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function CommunityPagePage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role = await getUserRole(supabase, user.id);
  const adminSupabase = createAdminClient();

  const { data: page } = await supabase
    .schema("membros")
    .from("community_pages")
    .select("id, title, slug, icon, description")
    .eq("slug", params.slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!page) notFound();

  // Marca a página como vista agora — zera o badge da sidebar.
  await supabase
    .schema("membros")
    .from("community_page_views")
    .upsert(
      {
        user_id: user.id,
        page_id: page.id,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,page_id" },
    );

  // Posts aprovados (RLS deixa user ver os próprios pendentes também,
  // mas o feed mostra só aprovados).
  const { data: postsData } = await supabase
    .schema("membros")
    .from("community_topics")
    .select(
      "id, page_id, user_id, title, content_html, video_url, image_url, likes_count, replies_count, is_pinned, created_at",
    )
    .eq("page_id", page.id)
    .eq("status", "approved")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  const posts = (postsData ?? []) as Array<{
    id: string;
    page_id: string;
    user_id: string;
    title: string;
    content_html: string | null;
    video_url: string | null;
    image_url: string | null;
    likes_count: number;
    replies_count: number;
    is_pinned: boolean;
    created_at: string;
  }>;

  // Hidrata autores (admin client pra ver todos) + decorações + level
  const userIds = Array.from(new Set(posts.map((p) => p.user_id)));
  const authors = new Map<
    string,
    {
      full_name: string | null;
      avatar_url: string | null;
    }
  >();
  if (userIds.length > 0) {
    const { data: users } = await adminSupabase
      .schema("membros")
      .from("users")
      .select("id, full_name, avatar_url")
      .in("id", userIds);
    for (const u of (users ?? []) as Array<{
      id: string;
      full_name: string | null;
      avatar_url: string | null;
    }>) {
      authors.set(u.id, { full_name: u.full_name, avatar_url: u.avatar_url });
    }
  }
  const authorMeta = await fetchAuthorMeta(adminSupabase, userIds);

  // Likes do user nos posts visíveis
  const likedSet = new Set<string>();
  if (posts.length > 0) {
    const { data: liked } = await supabase
      .schema("membros")
      .from("community_likes")
      .select("topic_id")
      .eq("user_id", user.id)
      .in(
        "topic_id",
        posts.map((p) => p.id),
      );
    for (const l of (liked ?? []) as Array<{ topic_id: string | null }>) {
      if (l.topic_id) likedSet.add(l.topic_id);
    }
  }

  // Próprios posts pendentes
  const { data: pendingMineData } = await supabase
    .schema("membros")
    .from("community_topics")
    .select("id, title, created_at, status")
    .eq("page_id", page.id)
    .eq("user_id", user.id)
    .neq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(5);
  const pendingMine = (pendingMineData ?? []) as Array<{
    id: string;
    title: string;
    created_at: string;
    status: string;
  }>;

  const cards: PostCardData[] = posts.map((p) => {
    const author = authors.get(p.user_id);
    const meta = authorMeta.get(p.user_id);
    return {
      id: p.id,
      title: p.title,
      contentHtml: p.content_html,
      videoUrl: p.video_url,
      imageUrl: p.image_url,
      likesCount: p.likes_count,
      repliesCount: p.replies_count,
      isPinned: p.is_pinned,
      createdAt: p.created_at,
      authorId: p.user_id,
      authorName: author?.full_name ?? "Aluno",
      authorAvatarUrl: author?.avatar_url ?? null,
      authorDecorationUrl: meta?.decorationUrl ?? null,
      authorLevel: meta?.level ?? null,
      liked: likedSet.has(p.id),
      pageSlug: page.slug ?? params.slug,
      pageId: page.id,
      pageTitle: page.title,
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <RealtimeFeedRefresher pageId={page.id} />
      {/* Em mobile só mostra o botão "Nova publicação" (título já vem na
          CommunityMobileBar). Em md+ mostra título + descrição completos. */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="hidden md:block">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">{page.icon ?? "💬"}</span>
            <h1 className="text-xl font-bold text-npb-text md:text-2xl">
              {page.title}
            </h1>
          </div>
          {page.description && (
            <p className="mt-1 text-sm text-npb-text-muted">
              {page.description}
            </p>
          )}
        </div>
        <CreatePostButton pageId={page.id} pageTitle={page.title} />
      </header>

      {pendingMine.length > 0 && (
        <section className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-yellow-400">
            Aguardando aprovação ({pendingMine.length})
          </h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {pendingMine.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 text-npb-text-muted"
              >
                <span className="truncate">{p.title}</span>
                <span className="text-[10px] uppercase tracking-wider">
                  {p.status === "rejected" ? "Rejeitado" : "Pendente"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-10 text-center">
          <p className="text-sm text-npb-text-muted">
            Nenhuma publicação por aqui ainda. Seja o primeiro!
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => (
            <PostCard
              key={card.id}
              post={card}
              currentRole={role}
              currentUserId={user.id}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
