import { Link2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { ShortLinksTable } from "@/components/admin/short-links-table";
import { ShortLinkCreateForm } from "@/components/admin/short-link-create-form";

export const dynamic = "force-dynamic";

export default async function AdminLinksPage() {
  const admin = createAdminClient().schema("membros");
  const { data: rowsRaw } = await admin
    .from("short_links")
    .select("slug, target_url, click_count, created_at, created_by")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (rowsRaw ?? []) as Array<{
    slug: string;
    target_url: string;
    click_count: number;
    created_at: string;
    created_by: string | null;
  }>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
          <Link2 className="h-3.5 w-3.5" />
          Encurtador
        </div>
        <h1 className="text-2xl font-bold text-npb-text">Links curtos</h1>
        <p className="text-sm text-npb-text-muted">
          URLs longas viram <code className="rounded bg-npb-bg3 px-1 text-npb-gold">/l/abc123</code>{" "}
          e redirecionam pro destino. Conta cliques. URLs com mais de 40
          caracteres em descrições de aulas são encurtadas automaticamente
          ao salvar.
        </p>
      </header>

      <ShortLinkCreateForm />

      <ShortLinksTable rows={rows} />
    </div>
  );
}
