"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { countPaidSales } from "@/lib/decorations";

export type ActionResult = { ok: boolean; error?: string };

/**
 * Aluno equipa uma decoração. Valida que ela está desbloqueada (vendas
 * suficientes). `decorationId=null` = remove (volta avatar limpo).
 */
export async function equipDecorationAction(
  decorationId: string | null,
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado." };

    const sb = createAdminClient();

    if (decorationId !== null) {
      // Valida: existe, ativa, e user tem vendas suficientes
      const { data: dec } = await sb
        .schema("membros")
        .from("avatar_decorations")
        .select("id, required_sales, is_active")
        .eq("id", decorationId)
        .maybeSingle();
      const d = dec as
        | { id: string; required_sales: number; is_active: boolean }
        | null;
      if (!d || !d.is_active) {
        return { ok: false, error: "Decoração indisponível." };
      }

      const sales = await countPaidSales(sb, user.id);
      if (sales < d.required_sales) {
        return { ok: false, error: "Decoração ainda não desbloqueada." };
      }
    }

    const { error } = await sb
      .schema("membros")
      .from("users")
      .update({ equipped_decoration_id: decorationId })
      .eq("id", user.id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/profile");
    revalidatePath("/community", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
