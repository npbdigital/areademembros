import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/access";
import { LayoutList } from "lucide-react";
import { PostCard, type PostCardData } from "@/components/community/post-card";
import { RealtimeFeedRefresher } from "@/components/community/realtime-feed-refresher";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function CommunityFeedPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role = await getUserRole(supabase, user.id);
  const adminSupabase = createAdminClient();

  // Pega todos os posts approved de páginas ativas, mais recentes primeiro
  const { data: postsData } = await supabase
    .schema("membros")
    .from("community_topics")
    .select(
      "id, page_id, user_id, title, content_html, video_url, image_url, likes_count, replies_count, is_pinned, created_at",
    )
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

  // Mapa de page_id → {slug, title} pra montar URL e label
  const pageIds = Array.from(new Set(posts.map((p) => p.page_id)));
  const pageMap = new Map<string, { slug: string; title: string }>();
  if (pageIds.length > 0) {
    const { data: pgs } = await supabase
      .schema("membros")
      .from("community_pages")
      .select("id, slug, title, is_active")
      .in("id", pageIds)
      .eq("is_active", true);
    for (const pg of (pgs ?? []) as Array<{
      id: string;
      slug: string | null;
      title: string;
      is_active: boolean;
    }>) {
      if (pg.slug) pageMap.set(pg.id, { slug: pg.slug, title: pg.title });
    }
  }

  // Filtra posts cuja página foi desativada / sem slug
  const visiblePosts = posts.filter((p) => pageMap.has(p.page_id));

  // Hidrata autores
  const userIds = Array.from(new Set(visiblePosts.map((p) => p.user_id)));
  const authors = new Map<
    string,
    { id: string; full_name: string | null; avatar_url: string | null }
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
      authors.set(u.id, u);
    }
  }

  // Likes do user
  const likedSet = new Set<string>();
  if (visiblePosts.length > 0) {
    const { data: liked } = await supabase
      .schema("membros")
      .from("community_likes")
      .select("topic_id")
      .eq("user_id", user.id)
      .in(
        "topic_id",
        visiblePosts.map((p) => p.id),
      );
    for (const l of (liked ?? []) as Array<{ topic_id: string | null }>) {
      if (l.topic_id) likedSet.add(l.topic_id);
    }
  }

  const cards: PostCardData[] = visiblePosts.map((p) => {
    const author = authors.get(p.user_id);
    const pg = pageMap.get(p.page_id)!;
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
      liked: likedSet.has(p.id),
      pageSlug: pg.slug,
      pageId: p.page_id,
      pageTitle: pg.title,
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <RealtimeFeedRefresher />
      {/* Header escondido em mobile — a CommunityMobileBar já mostra
          "Comunidade · Feed" no topo. Em md+ a sidebar é fixa, então
          o título ajuda a contextualizar. */}
      <header className="hidden md:block">
        <div className="flex items-center gap-2">
          <LayoutList className="h-6 w-6 text-npb-gold" />
          <h1 className="text-xl font-bold text-npb-text md:text-2xl">Feed</h1>
        </div>
        <p className="mt-1 text-sm text-npb-text-muted">
          Tudo que está acontecendo na comunidade, mais recente primeiro.
        </p>
      </header>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-10 text-center">
          <p className="text-sm text-npb-text-muted">
            Nada por aqui ainda. Quando alguém publicar em qualquer página, vai
            aparecer.
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
