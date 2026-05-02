import Link from "next/link";
import {
  ArrowRight,
  Crown,
  ExternalLink,
  GalleryHorizontal,
  MessageCircle,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminCommunityIndex() {
  const supabase = createAdminClient();

  const [
    { count: pendingCount },
    { count: spacesCount },
    { count: pagesCount },
    { count: postsTotal },
  ] = await Promise.all([
    supabase
      .schema("membros")
      .from("community_topics")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .schema("membros")
      .from("community_spaces")
      .select("id", { count: "exact", head: true }),
    supabase
      .schema("membros")
      .from("community_pages")
      .select("id", { count: "exact", head: true }),
    supabase
      .schema("membros")
      .from("community_topics")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-npb-text">Comunidade</h1>
          <p className="text-sm text-npb-text-muted">
            Modere publicações e veja o ranking. Espaços, páginas e atalhos da
            sidebar são gerenciados direto da tela da comunidade.
          </p>
        </div>
        <Link
          href="/community"
          className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-3.5 py-2 text-sm font-semibold text-black transition-colors hover:bg-npb-gold-light"
        >
          <ExternalLink className="h-4 w-4" />
          Ver comunidade
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          label="Espaços / páginas"
          value={(spacesCount ?? 0) + (pagesCount ?? 0)}
          subtitle={`${spacesCount ?? 0} espaço${spacesCount === 1 ? "" : "s"} · ${pagesCount ?? 0} página${pagesCount === 1 ? "" : "s"}`}
        />
      </div>

      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <h2 className="text-base font-semibold text-npb-text">Como funciona</h2>
        <ul className="mt-3 space-y-2 text-sm text-npb-text-muted">
          <li>
            • <strong>Espaços</strong> agrupam páginas (ex: &quot;Comece por aqui&quot;,
            &quot;Mentoria 20K&quot;). Não são clicáveis.
          </li>
          <li>
            • <strong>Páginas</strong> ficam dentro de um espaço e têm seu
            próprio feed (ex: &quot;Regras&quot;, &quot;Apresente-se&quot;).
          </li>
          <li>
            • Pra criar/editar, vá em{" "}
            <Link
              href="/community"
              className="inline-flex items-center gap-1 text-npb-gold hover:text-npb-gold-light"
            >
              /community
              <ExternalLink className="h-3 w-3" />
            </Link>{" "}
            e use os controles inline na sidebar (ícones que aparecem ao passar
            o mouse).
          </li>
          <li>
            • Toda publicação criada por aluno fica como{" "}
            <strong>pendente</strong> até admin/moderador aprovar (configurável
            em Configurações → Comunidade).
          </li>
          <li>
            • Acesso à comunidade é gateado por{" "}
            <code>cohort_courses.has_community_access</code> — defina nas
            turmas.
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
  subtitle,
}: {
  icon: typeof MessageCircle;
  label: string;
  value: number;
  href?: string;
  highlight?: boolean;
  subtitle?: string;
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
      {subtitle && (
        <div className="mt-0.5 text-[10px] text-npb-text-muted">{subtitle}</div>
      )}
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
