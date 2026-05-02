"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; error?: string };

/**
 * Marca o usuário atual como tendo aceitado os termos de boas-vindas.
 * Setado uma vez — o popup nunca mais aparece.
 */
export async function acceptWelcomeAction(): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sessão inválida." };

    const { error } = await supabase
      .schema("membros")
      .from("users")
      .update({ welcome_accepted_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}
