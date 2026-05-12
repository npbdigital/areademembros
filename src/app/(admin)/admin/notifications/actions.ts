"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { type BroadcastAudience, sendBroadcast } from "@/lib/push";
import { findUnsupportedPlaceholders } from "@/lib/broadcast-link";

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
    // Avisa se o admin usou {{xpto}} com variavel desconhecida — vai virar
    // string vazia silenciosamente, melhor explicitar antes de mandar.
    if (link) {
      const unsupported = findUnsupportedPlaceholders(link);
      if (unsupported.length > 0) {
        return {
          ok: false,
          error: `Variáveis desconhecidas no link: ${unsupported.map((v) => `{{${v}}}`).join(", ")}. Disponíveis: {{firstName}}, {{lastName}}, {{fullName}}, {{email}}, {{phone}}, {{cpf}}.`,
        };
      }
    }

    // Audience: lê os 3 fields do form
    const includeRaw = formData.getAll("include_cohort_ids").map(String);
    const excludeRaw = formData.getAll("exclude_cohort_ids").map(String);
    const rolesRaw = formData.getAll("roles").map(String);

    const engagementRaw = String(formData.get("engagement") ?? "all");
    const engagement: "active" | "inactive" | "all" =
      engagementRaw === "active" || engagementRaw === "inactive"
        ? engagementRaw
        : "all";

    const audience: BroadcastAudience = {
      include_cohort_ids: includeRaw.filter(Boolean),
      exclude_cohort_ids: excludeRaw.filter(Boolean),
      roles: rolesRaw.filter(Boolean).length > 0 ? rolesRaw.filter(Boolean) : undefined,
      engagement,
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

    // Popup — expira em (opcional, mesmo formato do banner)
    let popupExpiresAt: string | null = null;
    const popupExpRaw = String(formData.get("popup_expires_at") ?? "").trim();
    if (deliverPopup && popupExpRaw) {
      const withTz = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(popupExpRaw)
        ? popupExpRaw
        : popupExpRaw + "-03:00";
      const d = new Date(withTz);
      if (!Number.isNaN(d.getTime())) popupExpiresAt = d.toISOString();
    }

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
      popupExpiresAt,
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

/**
 * Interrompe a entrega de banner/popup que ainda esta rodando — seta as
 * datas de expiracao pra agora. Push e in-app ja foram entregues no envio
 * e nao tem como desfazer; isso aqui afeta so quem ainda nao viu o
 * banner/popup. Quem ja viu, viu.
 */
export async function stopBroadcastDeliveryAction(
  broadcastId: string,
): Promise<ActionResult<{ stopped: { banner: boolean; popup: boolean } }>> {
  try {
    await assertAdmin();
    const admin = createAdminClient();

    const { data: bc, error: fetchErr } = await admin
      .schema("membros")
      .from("push_broadcasts")
      .select(
        "id, deliver_banner, banner_expires_at, deliver_popup, popup_expires_at",
      )
      .eq("id", broadcastId)
      .single();

    if (fetchErr || !bc) {
      return { ok: false, error: "Anúncio não encontrado." };
    }

    const row = bc as {
      deliver_banner: boolean;
      banner_expires_at: string | null;
      deliver_popup: boolean;
      popup_expires_at: string | null;
    };

    const nowIso = new Date().toISOString();
    const stopBanner =
      row.deliver_banner &&
      (row.banner_expires_at === null || row.banner_expires_at > nowIso);
    const stopPopup =
      row.deliver_popup &&
      (row.popup_expires_at === null || row.popup_expires_at > nowIso);

    if (!stopBanner && !stopPopup) {
      return {
        ok: false,
        error:
          "Nada pra interromper — push/in-app já foram entregues no envio.",
      };
    }

    const update: Record<string, string> = {};
    if (stopBanner) update.banner_expires_at = nowIso;
    if (stopPopup) update.popup_expires_at = nowIso;

    const { error: updErr } = await admin
      .schema("membros")
      .from("push_broadcasts")
      .update(update)
      .eq("id", broadcastId);

    if (updErr) return { ok: false, error: updErr.message };

    revalidatePath("/admin/notifications/broadcast");
    return {
      ok: true,
      data: { stopped: { banner: stopBanner, popup: stopPopup } },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
