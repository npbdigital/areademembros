import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/access";
import {
  type CommunityPageRow,
  type CommunitySidebarLinkRow,
  type CommunitySpaceRow,
  userHasCommunityAccess,
} from "@/lib/community";
import { CommunitySidebar } from "@/components/community/community-sidebar";
import { CommunityMobileBar } from "@/components/community/community-mobile-bar";

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

  // Carrega espaços, páginas, links da sidebar
  const [
    { data: spacesData },
    { data: pagesData },
    { data: linksData },
  ] = await Promise.all([
    supabase
      .schema("membros")
      .from("community_spaces")
      .select("id, title, position, is_active")
      .eq("is_active", true)
      .order("position", { ascending: true }),
    supabase
      .schema("membros")
      .from("community_pages")
      .select(
        "id, space_id, title, slug, icon, description, position, is_active",
      )
      .eq("is_active", true)
      .order("position", { ascending: true }),
    supabase
      .schema("membros")
      .from("community_sidebar_links")
      .select("id, label, url, icon, position, open_in_new_tab, is_active")
      .eq("is_active", true)
      .order("position", { ascending: true }),
  ]);

  const spaces = (spacesData ?? []) as CommunitySpaceRow[];
  const pages = (pagesData ?? []) as CommunityPageRow[];
  const links = (linksData ?? []) as CommunitySidebarLinkRow[];

  // Badges de não-lidos por página
  const unreadByPage = new Map<string, number>();
  if (pages.length > 0) {
    const adminSb = createAdminClient();
    const pageIds = pages.map((p) => p.id);

    const { data: viewsData } = await supabase
      .schema("membros")
      .from("community_page_views")
      .select("page_id, last_seen_at")
      .eq("user_id", user.id)
      .in("page_id", pageIds);

    const seenMap = new Map<string, string>();
    for (const v of (viewsData ?? []) as Array<{
      page_id: string;
      last_seen_at: string;
    }>) {
      seenMap.set(v.page_id, v.last_seen_at);
    }

    await Promise.all(
      pages.map(async (p) => {
        const seen = seenMap.get(p.id);
        let q = adminSb
          .schema("membros")
          .from("community_topics")
          .select("id", { count: "exact", head: true })
          .eq("page_id", p.id)
          .eq("status", "approved");
        if (seen) q = q.gt("created_at", seen);
        q = q.neq("user_id", user.id);
        const { count } = await q;
        if ((count ?? 0) > 0) unreadByPage.set(p.id, count ?? 0);
      }),
    );
  }

  const sidebarEl = (
    <CommunitySidebar
      spaces={spaces}
      pages={pages}
      links={links}
      unreadByPage={Object.fromEntries(unreadByPage)}
      canManage={role === "admin" || role === "moderator"}
    />
  );

  return (
    <div className="-mx-4 -my-4 flex min-h-[calc(100vh-3.5rem)] flex-col md:-mx-8 md:-my-8 md:flex-row">
      {/* Sidebar fixa em desktop */}
      <div className="hidden md:flex">{sidebarEl}</div>
      {/* Mobile: o título "Comunidade · {página}" + hamburger são portados
          pra dentro da Topbar (slot #topbar-mobile-slot). Não cria barra
          empilhada — UI fica mais enxuta. */}
      <CommunityMobileBar pages={pages}>{sidebarEl}</CommunityMobileBar>
      <main className="flex-1 overflow-y-auto npb-scrollbar p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
