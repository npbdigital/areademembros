import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { AchievementFlagsRow } from "@/components/admin/achievement-flags-row";

export const dynamic = "force-dynamic";

export default async function AdminAchievementsPage() {
  const supabase = createAdminClient();

  const [{ data: achievements }, { data: decorations }] = await Promise.all([
    supabase
      .schema("membros")
      .from("achievements")
      .select(
        "id, code, name, description, icon, category, required_value, xp_reward, celebrate, shareable, celebration_image_url, unlocks_decoration_id, sort_order, is_active",
      )
      .order("sort_order", { ascending: true }),
    supabase
      .schema("membros")
      .from("avatar_decorations")
      .select("id, code, name, image_url, required_sales")
      .eq("is_active", true)
      .order("required_sales", { ascending: true }),
  ]);

  const items = (achievements ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    icon: string;
    category: string;
    required_value: number;
    xp_reward: number;
    celebrate: boolean;
    shareable: boolean;
    celebration_image_url: string | null;
    unlocks_decoration_id: string | null;
    sort_order: number;
    is_active: boolean;
  }>;
  const decoOptions = (decorations ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    image_url: string | null;
    required_sales: number;
  }>;

  // Agrupa por categoria
  const byCategory = new Map<string, typeof items>();
  for (const a of items) {
    const arr = byCategory.get(a.category) ?? [];
    arr.push(a);
    byCategory.set(a.category, arr);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1 text-sm text-npb-text-muted hover:text-npb-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>
        <h1 className="mt-3 inline-flex items-center gap-2 text-xl font-bold text-npb-text">
          <Trophy className="h-5 w-5 text-npb-gold" />
          Conquistas
        </h1>
        <p className="text-sm text-npb-text-muted">
          Configure quais conquistas disparam <strong>popup celebrativo</strong>{" "}
          (com confetti) e/ou podem ser <strong>compartilhadas</strong> na
          página <code>/community/resultados</code>.
        </p>
      </div>

      <div className="rounded-xl border border-npb-border bg-npb-bg2 p-4 text-xs text-npb-text-muted">
        <p>
          📌 <strong className="text-npb-text">celebrate</strong> = aparece o
          popup grande com fogos quando aluno desbloqueia.{" "}
          <strong className="text-npb-text">shareable</strong> = aparece o
          botão &quot;Compartilhar nos resultados&quot; no popup. As 2 podem
          ser ligadas independente.
        </p>
      </div>

      {Array.from(byCategory.entries()).map(([cat, arr]) => (
        <section key={cat}>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-npb-text-muted">
            {labelCategory(cat)} ({arr.length})
          </h2>
          <ul className="space-y-1.5">
            {arr.map((a) => (
              <AchievementFlagsRow
                key={a.id}
                achievement={{
                  id: a.id,
                  code: a.code,
                  name: a.name,
                  description: a.description,
                  icon: a.icon,
                  xpReward: a.xp_reward,
                  celebrate: a.celebrate,
                  shareable: a.shareable,
                  imageUrl: a.celebration_image_url,
                  unlocksDecorationId: a.unlocks_decoration_id,
                }}
                decorationOptions={decoOptions}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function labelCategory(cat: string): string {
  const map: Record<string, string> = {
    first_time: "🎯 Primeira vez",
    streak: "🔥 Sequência (streak)",
    volume: "📚 Volume",
    community: "💬 Comunidade",
    sales_count: "🏆 Vendas (quantidade)",
    sales_value: "💰 Vendas (comissão R$)",
  };
  return map[cat] ?? cat;
}
