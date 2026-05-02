import Link from "next/link";
import { ArrowRight, Crown, GalleryHorizontal, Link2, MessageCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminCommunityIndex() {
  const supabase = createAdminClient();

  const [
    { count: pendingCount },
    { count: galleriesCount },
    { count: linksCount },
    { count: postsTotal },
  ] = await Promise.all([
    supabase
      .schema("membros")
      .from("community_topics")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .schema("membros")
      .from("community_galleries")
      .select("id", { count: "exact", head: true }),
    supabase
      .schema("membros")
      .from("community_sidebar_links")
      .select("id", { count: "exact", head: true }),
    supabase
      .schema("membros")
      .from("community_topics")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-bold text-npb-text">Comunidade</h1>
        <p className="text-sm text-npb-text-muted">
          Modere publicações, gerencie espaços e atalhos.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AdminCard
          icon={MessageCircle}
          label="Aguardando aprovação"
          value={pendingCount ?? 0}
          href="/admin/community/queue"
          highlight={Boolean(pendingCount && pendingCount > 0)}
        />
        <AdminCard
          icon={MessageCircle}
          label="Posts aprovados"
          value={postsTotal ?? 0}
        />
        <AdminCard
          icon={Crown}
          label="Leaderboard"
          value={0}
          href="/admin/community/leaderboard"
        />
        <AdminCard
          icon={GalleryHorizontal}
          label="Espaços"
          value={galleriesCount ?? 0}
          href="/admin/community/spaces"
        />
        <AdminCard
          icon={Link2}
          label="Atalhos da sidebar"
          value={linksCount ?? 0}
          href="/admin/community/links"
        />
      </div>

      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <h2 className="text-base font-semibold text-npb-text">Como funciona</h2>
        <ul className="mt-3 space-y-2 text-sm text-npb-text-muted">
          <li>
            • Toda publicação criada por aluno fica como{" "}
            <strong>pendente</strong> até admin/moderador aprovar.
          </li>
          <li>
            • Posts criados por admin/moderador entram já aprovados (auto-publish).
          </li>
          <li>
            • Acesso à comunidade é gateado por{" "}
            <code>cohort_courses.has_community_access</code> — defina nas turmas.
          </li>
        </ul>
      </div>
    </div>
  );
}

function AdminCard({
  icon: Icon,
  label,
  value,
  href,
  highlight,
}: {
  icon: typeof MessageCircle;
  label: string;
  value: number;
  href?: string;
  highlight?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <Icon
          className={
            highlight ? "h-5 w-5 text-yellow-400" : "h-5 w-5 text-npb-gold"
          }
        />
        {href && <ArrowRight className="h-3.5 w-3.5 text-npb-text-muted" />}
      </div>
      <div className="mt-2 text-2xl font-bold text-npb-text">{value}</div>
      <div className="text-xs uppercase tracking-wider text-npb-text-muted">
        {label}
      </div>
    </>
  );
  const className = `block rounded-xl border p-4 transition-colors ${
    highlight
      ? "border-yellow-500/40 bg-yellow-500/5"
      : "border-npb-border bg-npb-bg2 hover:border-npb-gold-dim"
  }`;
  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}
