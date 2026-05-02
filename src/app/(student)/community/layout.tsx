import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/access";
import {
  type CommunityGalleryRow,
  type CommunitySidebarLinkRow,
  userHasCommunityAccess,
} from "@/lib/community";
import { CommunitySidebar } from "@/components/community/community-sidebar";

export const dynamic = "force-dynamic";

export default async function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await getUserRole(supabase, user.id);
  const hasAccess = await userHasCommunityAccess(supabase, user.id, role);

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-8 text-center">
          <Lock className="mx-auto h-10 w-10 text-npb-gold" />
          <h1 className="mt-4 text-xl font-bold text-npb-text">
            Comunidade indisponível
          </h1>
          <p className="mt-2 text-sm text-npb-text-muted">
            A sua matrícula atual não inclui acesso à comunidade. Se acredita
            que deveria ter, fale com o suporte.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-npb-border bg-npb-bg3 px-4 py-2 text-sm font-semibold text-npb-text transition hover:border-npb-gold"
          >
            Voltar à biblioteca
          </Link>
        </div>
      </div>
    );
  }

  // Carrega galerias visíveis e links da sidebar
  const [{ data: galleriesData }, { data: linksData }] = await Promise.all([
    supabase
      .schema("membros")
      .from("community_galleries")
      .select("id, title, slug, icon, position, is_active")
      .eq("is_active", true)
      .order("position", { ascending: true }),
    supabase
      .schema("membros")
      .from("community_sidebar_links")
      .select("id, label, url, icon, position, open_in_new_tab, is_active")
      .eq("is_active", true)
      .order("position", { ascending: true }),
  ]);

  const galleries = (galleriesData ?? []) as CommunityGalleryRow[];
  const links = (linksData ?? []) as CommunitySidebarLinkRow[];

  // Badges de não-lidos por espaço: pra cada galeria, conta posts approved
  // com created_at > last_seen_at (ou TODOS se nunca visitou).
  const unreadByGallery = new Map<string, number>();
  if (galleries.length > 0) {
    const adminSb = createAdminClient();
    const galleryIds = galleries.map((g) => g.id);

    const { data: viewsData } = await supabase
      .schema("membros")
      .from("community_space_views")
      .select("gallery_id, last_seen_at")
      .eq("user_id", user.id)
      .in("gallery_id", galleryIds);

    const seenMap = new Map<string, string>();
    for (const v of (viewsData ?? []) as Array<{
      gallery_id: string;
      last_seen_at: string;
    }>) {
      seenMap.set(v.gallery_id, v.last_seen_at);
    }

    // Conta de cada galeria. Limita a 1 query por galeria, mas como N é
    // pequeno (umas dezenas no máximo), tá OK.
    await Promise.all(
      galleries.map(async (g) => {
        const seen = seenMap.get(g.id);
        let q = adminSb
          .schema("membros")
          .from("community_topics")
          .select("id", { count: "exact", head: true })
          .eq("gallery_id", g.id)
          .eq("status", "approved");
        if (seen) q = q.gt("created_at", seen);
        // Não conta os próprios posts do user
        q = q.neq("user_id", user.id);
        const { count } = await q;
        if ((count ?? 0) > 0) unreadByGallery.set(g.id, count ?? 0);
      }),
    );
  }

  return (
    <div className="-mx-4 -my-4 flex min-h-[calc(100vh-3.5rem)] md:-mx-8 md:-my-8">
      <CommunitySidebar
        galleries={galleries}
        links={links}
        unreadByGallery={Object.fromEntries(unreadByGallery)}
      />
      <main className="flex-1 overflow-y-auto npb-scrollbar p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
