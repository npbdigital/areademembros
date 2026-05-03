"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; error?: string };

async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");
  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    throw new Error("Sem permissão.");
  }
}

export async function setAchievementFlagsAction(params: {
  achievementId: string;
  celebrate?: boolean;
  shareable?: boolean;
}): Promise<ActionResult> {
  try {
    await assertAdmin();
    const updates: Record<string, unknown> = {};
    if (typeof params.celebrate === "boolean") {
      updates.celebrate = params.celebrate;
    }
    if (typeof params.shareable === "boolean") {
      updates.shareable = params.shareable;
    }
    if (Object.keys(updates).length === 0) {
      return { ok: false, error: "Nada pra atualizar." };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .schema("membros")
      .from("achievements")
      .update(updates)
      .eq("id", params.achievementId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/achievements");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
