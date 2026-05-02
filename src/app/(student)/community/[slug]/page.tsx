import { notFound } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/access";
import { PostCard, type PostCardData } from "@/components/community/post-card";
import { CreatePostButton } from "@/components/community/create-post-button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function CommunityGalleryPage({
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

  const { data: gallery } = await supabase
    .schema("membros")
    .from("community_galleries")
    .select("id, title, slug, icon, description")
    .eq("slug", params.slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!gallery) notFound();

  // Posts aprovados (RLS deixa user ver os próprios pendentes também,
  // mas o feed mostra só aprovados).
  const { data: postsData } = await supabase
    .schema("membros")
    .from("community_topics")
    .select(
      "id, gallery_id, user_id, title, content_html, video_url, image_url, likes_count, replies_count, created_at",
    )
    .eq("gallery_id", gallery.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  const posts = (postsData ?? []) as Array<{
    id: string;
    gallery_id: string;
    user_id: string;
    title: string;
    content_html: string | null;
    video_url: string | null;
    image_url: string | null;
    likes_count: number;
    replies_count: number;
    created_at: string;
  }>;

  // Hidrata autores (admin client pra ver todos)
  const userIds = Array.from(new Set(posts.map((p) => p.user_id)));
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

  // Próprios posts pendentes (mostra no topo pra dar feedback ao autor)
  const { data: pendingMineData } = await supabase
    .schema("membros")
    .from("community_topics")
    .select("id, title, created_at, status")
    .eq("gallery_id", gallery.id)
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
    return {
      id: p.id,
      title: p.title,
      contentHtml: p.content_html,
      videoUrl: p.video_url,
      imageUrl: p.image_url,
      likesCount: p.likes_count,
      repliesCount: p.replies_count,
      createdAt: p.created_at,
      authorName: author?.full_name ?? "Aluno",
      authorAvatarUrl: author?.avatar_url ?? null,
      liked: likedSet.has(p.id),
      gallerySlug: gallery.slug ?? params.slug,
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">{gallery.icon ?? "💬"}</span>
            <h1 className="text-xl font-bold text-npb-text md:text-2xl">
              {gallery.title}
            </h1>
          </div>
          {gallery.description && (
            <p className="mt-1 text-sm text-npb-text-muted">
              {gallery.description}
            </p>
          )}
        </div>
        <CreatePostButton galleryId={gallery.id} galleryTitle={gallery.title} />
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
            <PostCard key={card.id} post={card} currentRole={role} />
          ))}
        </ul>
      )}
    </div>
  );
}
