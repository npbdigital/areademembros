"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PushCategory } from "@/lib/push";

export type ActionResult = { ok: boolean; error?: string };

export async function subscribePushAction(params: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado." };

    if (!params.endpoint || !params.keys?.p256dh || !params.keys?.auth) {
      return { ok: false, error: "Subscription inválida." };
    }

    // Upsert por endpoint (mesmo dispositivo pode re-subscribe)
    const { data: existing } = await supabase
      .schema("membros")
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", params.endpoint)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .schema("membros")
        .from("push_subscriptions")
        .update({
          user_id: user.id,
          keys_p256dh: params.keys.p256dh,
          keys_auth: params.keys.auth,
          user_agent: params.userAgent ?? null,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase
        .schema("membros")
        .from("push_subscriptions")
        .insert({
          user_id: user.id,
          endpoint: params.endpoint,
          keys_p256dh: params.keys.p256dh,
          keys_auth: params.keys.auth,
          user_agent: params.userAgent ?? null,
        });
      if (error) return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function unsubscribePushAction(
  endpoint: string,
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado." };

    const { error } = await supabase
      .schema("membros")
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function setNotificationPrefAction(params: {
  category: PushCategory;
  pushEnabled: boolean;
}): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado." };

    if (params.category === "broadcast") {
      // broadcast não pode ser desligado pelo user
      return { ok: false, error: "Anúncios não podem ser desativados." };
    }

    const { error } = await supabase
      .schema("membros")
      .from("user_notification_prefs")
      .upsert(
        {
          user_id: user.id,
          category: params.category,
          push_enabled: params.pushEnabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,category" },
      );
    if (error) return { ok: false, error: error.message };

    revalidatePath("/profile");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
