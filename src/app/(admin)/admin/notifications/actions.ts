"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { type BroadcastAudience, sendBroadcast } from "@/lib/push";

export type ActionResult<T = unknown> = {
  ok: boolean;
  error?: string;
  data?: T;
};

/**
 * Upload da imagem que vai aparecer no topo do popup grande de broadcast.
 * Bucket público com leitura aberta (qualquer aluno enxerga); escrita
 * só pra admin via membros.is_admin().
 */
export async function uploadBroadcastPopupImageAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  try {
    await assertAdmin();

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "Arquivo inválido." };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { ok: false, error: "Imagem maior que 5MB." };
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      return { ok: false, error: "Formato não suportado (use JPG/PNG/WebP)." };
    }

    const admin = createAdminClient();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("broadcast-popup-images")
      .upload(path, file, { contentType: file.type, cacheControl: "3600" });
    if (upErr) return { ok: false, error: upErr.message };

    const { data } = admin.storage
      .from("broadcast-popup-images")
      .getPublicUrl(path);
    return { ok: true, data: { url: data.publicUrl } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

async function assertAdmin(): Promise<string> {
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
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin" && role !== "moderator") {
    throw new Error("Sem permissão.");
  }
  return user.id;
}

export async function sendBroadcastAction(
  _prev: ActionResult<{ broadcastId: string; recipientsCount: number; delivered: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ broadcastId: string; recipientsCount: number; delivered: number }>> {
  try {
    const userId = await assertAdmin();

    const title = String(formData.get("title") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim() || null;
    const link = String(formData.get("link") ?? "").trim() || null;
    const linkLabelRaw = String(formData.get("link_label") ?? "").trim();
    const linkLabel = link && linkLabelRaw ? linkLabelRaw.slice(0, 30) : null;

    if (!title) return { ok: false, error: "Título é obrigatório." };
    if (title.length > 80) {
      return { ok: false, error: "Título muito longo (max 80 chars — limite do SO)." };
    }
    if (body && body.length > 200) {
      return { ok: false, error: "Mensagem muito longa (max 200 chars)." };
    }
    if (link && !link.startsWith("/") && !link.startsWith("http")) {
      return { ok: false, error: 'Link inválido. Use /caminho ou https://...' };
    }

    // Audience: lê os 3 fields do form
    const includeRaw = formData.getAll("include_cohort_ids").map(String);
    const excludeRaw = formData.getAll("exclude_cohort_ids").map(String);
    const rolesRaw = formData.getAll("roles").map(String);

    const audience: BroadcastAudience = {
      include_cohort_ids: includeRaw.filter(Boolean),
      exclude_cohort_ids: excludeRaw.filter(Boolean),
      roles: rolesRaw.filter(Boolean).length > 0 ? rolesRaw.filter(Boolean) : undefined,
    };

    // Canais de entrega — pelo menos 1 obrigatório
    const deliverPush = formData.get("deliver_push") === "on";
    const deliverInapp = formData.get("deliver_inapp") === "on";
    const deliverBanner = formData.get("deliver_banner") === "on";
    const deliverPopup = formData.get("deliver_popup") === "on";
    if (!deliverPush && !deliverInapp && !deliverBanner && !deliverPopup) {
      return {
        ok: false,
        error: "Selecione pelo menos um canal de entrega.",
      };
    }

    // Banner — expira em (opcional, datetime-local em BRT)
    let bannerExpiresAt: string | null = null;
    const expRaw = String(formData.get("banner_expires_at") ?? "").trim();
    if (deliverBanner && expRaw) {
      const withTz = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(expRaw)
        ? expRaw
        : expRaw + "-03:00";
      const d = new Date(withTz);
      if (!Number.isNaN(d.getTime())) bannerExpiresAt = d.toISOString();
    }

    // Popup — image_url opcional (URL completa)
    const popupImageUrl =
      String(formData.get("popup_image_url") ?? "").trim() || null;

    const result = await sendBroadcast({
      sentBy: userId,
      title,
      body,
      link,
      linkLabel,
      audience,
      deliverPush,
      deliverInapp,
      deliverBanner,
      bannerExpiresAt,
      deliverPopup,
      popupImageUrl,
    });

    revalidatePath("/admin/notifications/broadcast");
    return {
      ok: true,
      data: {
        broadcastId: result.broadcastId,
        recipientsCount: result.recipientsCount,
        delivered: result.delivered,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
