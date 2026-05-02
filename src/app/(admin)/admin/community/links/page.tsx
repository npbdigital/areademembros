import Link from "next/link";
import { ArrowLeft, Link2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { LinkListEditor } from "@/components/admin/community/link-list-editor";

export const dynamic = "force-dynamic";

export default async function CommunityLinksPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .schema("membros")
    .from("community_sidebar_links")
    .select("id, label, url, icon, position, open_in_new_tab, is_active")
    .order("position", { ascending: true });

  const items = (data ?? []) as Array<{
    id: string;
    label: string;
    url: string;
    icon: string | null;
    position: number;
    open_in_new_tab: boolean;
    is_active: boolean;
  }>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/community"
          className="inline-flex items-center gap-1 text-sm text-npb-text-muted hover:text-npb-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>
        <h1 className="mt-3 inline-flex items-center gap-2 text-xl font-bold text-npb-text">
          <Link2 className="h-5 w-5 text-npb-gold" />
          Atalhos da sidebar
        </h1>
        <p className="text-sm text-npb-text-muted">
          Links externos exibidos abaixo dos espaços (ex: WhatsApp, blog, área
          VIP).
        </p>
      </div>

      <LinkListEditor items={items} />
    </div>
  );
}
