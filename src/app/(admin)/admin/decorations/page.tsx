import { Sparkles } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { DecorationRowEditor } from "@/components/admin/decoration-row-editor";

export const dynamic = "force-dynamic";

interface DecorationRow {
  id: string;
  code: string;
  name: string;
  image_url: string | null;
  required_sales: number;
  sort_order: number;
  is_active: boolean;
}

export default async function AdminDecorationsPage() {
  const sb = createAdminClient();
  const { data } = await sb
    .schema("membros")
    .from("avatar_decorations")
    .select(
      "id, code, name, image_url, required_sales, sort_order, is_active",
    )
    .order("sort_order", { ascending: true });

  const decorations = (data ?? []) as DecorationRow[];

  // Quantos alunos têm cada decoração equipada (estatística)
  const equippedCounts = new Map<string, number>();
  for (const d of decorations) {
    const { count } = await sb
      .schema("membros")
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("equipped_decoration_id", d.id);
    equippedCounts.set(d.id, count ?? 0);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
          <Sparkles className="h-3.5 w-3.5" />
          Decorações de avatar
        </div>
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          Frames pro avatar
        </h1>
        <p className="mt-1 text-sm text-npb-text-muted">
          PNG/WebP/GIF transparente, recomendado <strong>512×512</strong> com
          centro vazio (avatar passa por baixo). Aluno desbloqueia
          automaticamente ao bater os marcos de vendas — só você sabe quantas
          vendas cada um precisa.
        </p>
      </header>

      <div className="rounded-2xl border border-npb-border bg-npb-bg2/40 p-4 text-xs text-npb-text-muted">
        <p>
          <strong className="text-npb-text">Como funciona:</strong> quando o
          aluno bate o marco (ex: 1ª venda Kiwify atribuída), a decoração mais
          alta que ele se qualifica é equipada automaticamente + ele recebe uma
          notificação. Pode trocar/remover no perfil dele. Sem o PNG subido,
          o slot existe mas não aparece pro aluno.
        </p>
      </div>

      <ul className="space-y-3">
        {decorations.map((d) => (
          <DecorationRowEditor
            key={d.id}
            decoration={d}
            equippedCount={equippedCounts.get(d.id) ?? 0}
          />
        ))}
      </ul>
    </div>
  );
}
