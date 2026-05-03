/**
 * Web Push helpers — envia notificações push pra dispositivos cadastrados.
 *
 * Requer 3 env vars:
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY (também exposta no client pra subscribe)
 *   - VAPID_PRIVATE_KEY
 *   - VAPID_SUBJECT (mailto:... — contato técnico)
 *
 * Sem essas vars setadas, `tryPushToUser` faz silent-noop (app continua
 * funcionando, só não envia push). Útil pra dev local sem keys.
 */

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";

export type PushCategory =
  | "broadcast"
  | "community_comment"
  | "community_reply"
  | "community_post_status"
  | "achievement_unlocked"
  | "lesson_drip"
  | "kiwify_sale_attributed";

export interface PushPayload {
  title: string;
  body?: string;
  link?: string;
  /** Tag pra agrupar/substituir push do mesmo tipo (ex: "post-{id}"). */
  tag?: string;
  /** Ícone customizado (URL). Default usa o ícone do PWA. */
  icon?: string;
}

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Confere se o user opted-out daquela categoria via user_notification_prefs.
 * Default = true (recebe). `broadcast` ignora a tabela (sempre dispara).
 */
async function isCategoryEnabledForUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  category: PushCategory,
): Promise<boolean> {
  if (category === "broadcast") return true;

  const { data } = await admin
    .schema("membros")
    .from("user_notification_prefs")
    .select("push_enabled")
    .eq("user_id", userId)
    .eq("category", category)
    .maybeSingle();

  if (!data) return true; // ausente = default true
  return Boolean((data as { push_enabled: boolean }).push_enabled);
}

/**
 * Envia push pra TODAS as subscriptions ativas do user.
 * - Verifica setting global (kill switch admin)
 * - Verifica preferência do user na categoria
 * - Trata erro 410 Gone removendo a subscription expirada
 *
 * Retorna { delivered, failed }.
 */
export async function sendPushToUser(params: {
  userId: string;
  category: PushCategory;
  payload: PushPayload;
}): Promise<{ delivered: number; failed: number }> {
  if (!ensureVapid()) return { delivered: 0, failed: 0 };

  const admin = createAdminClient();

  // Setting global ligado?
  const settings = await getPlatformSettings(admin);
  if (!settings.pushNotificationsEnabled) {
    return { delivered: 0, failed: 0 };
  }

  // User opt-in na categoria?
  const allowed = await isCategoryEnabledForUser(
    admin,
    params.userId,
    params.category,
  );
  if (!allowed) return { delivered: 0, failed: 0 };

  // Pega subscriptions
  const { data: subs } = await admin
    .schema("membros")
    .from("push_subscriptions")
    .select("id, endpoint, keys_p256dh, keys_auth")
    .eq("user_id", params.userId);

  const subscriptions = (subs ?? []) as Array<{
    id: string;
    endpoint: string;
    keys_p256dh: string;
    keys_auth: string;
  }>;

  if (subscriptions.length === 0) return { delivered: 0, failed: 0 };

  const payloadStr = JSON.stringify(params.payload);
  let delivered = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
          },
          payloadStr,
        );
        delivered++;
        // Atualiza last_used_at (best effort)
        await admin
          .schema("membros")
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", sub.id);
      } catch (err: unknown) {
        failed++;
        // 410 Gone ou 404 Not Found → subscription expirada, remove
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await admin
            .schema("membros")
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }
      }
    }),
  );

  return { delivered, failed };
}

/**
 * Wrapper silent-fail pro tryNotify integrar sem se preocupar com erros.
 */
export async function tryPushToUser(params: {
  userId: string;
  category: PushCategory;
  payload: PushPayload;
}): Promise<void> {
  try {
    await sendPushToUser(params);
  } catch {
    // best-effort
  }
}

/**
 * Resolve quais user_ids elegíveis pra um broadcast baseado no audience.
 *
 * Regra:
 *   - audience.roles (filtra roles permitidas; default = ['student','ficticio'])
 *   - audience.include_cohort_ids (TODAS precisam estar nas matrículas ativas)
 *   - audience.exclude_cohort_ids (NENHUMA pode estar)
 *   - sem include nem exclude = todos os users com role permitida
 */
export interface BroadcastAudience {
  roles?: string[]; // ['student', 'ficticio', 'moderator', 'admin']
  include_cohort_ids?: string[];
  exclude_cohort_ids?: string[];
}

export async function resolveBroadcastAudience(
  audience: BroadcastAudience,
): Promise<string[]> {
  const admin = createAdminClient();
  const roles = audience.roles?.length
    ? audience.roles
    : ["student", "ficticio"];

  // Pega todos os users com a role
  const { data: usersData } = await admin
    .schema("membros")
    .from("users")
    .select("id")
    .in("role", roles)
    .eq("is_active", true);
  let userIds = ((usersData ?? []) as Array<{ id: string }>).map((u) => u.id);

  if (userIds.length === 0) return [];

  const include = audience.include_cohort_ids ?? [];
  const exclude = audience.exclude_cohort_ids ?? [];

  if (include.length === 0 && exclude.length === 0) {
    return userIds;
  }

  // Pega matrículas ativas dos candidatos
  const nowIso = new Date().toISOString();
  const { data: enrollData } = await admin
    .schema("membros")
    .from("enrollments")
    .select("user_id, cohort_id")
    .in("user_id", userIds)
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  const userCohorts = new Map<string, Set<string>>();
  for (const e of (enrollData ?? []) as Array<{
    user_id: string;
    cohort_id: string;
  }>) {
    const set = userCohorts.get(e.user_id) ?? new Set<string>();
    set.add(e.cohort_id);
    userCohorts.set(e.user_id, set);
  }

  userIds = userIds.filter((uid) => {
    const cohorts = userCohorts.get(uid) ?? new Set<string>();
    // Include: TODAS precisam estar
    for (const c of include) {
      if (!cohorts.has(c)) return false;
    }
    // Exclude: NENHUMA pode estar
    for (const c of exclude) {
      if (cohorts.has(c)) return false;
    }
    return true;
  });

  return userIds;
}

/**
 * Envia broadcast pra audiência. Salva em push_broadcasts pra histórico.
 * Retorna o id do broadcast criado.
 *
 * Cria também notificação in-app pra cada destinatário (categoria 'broadcast'
 * sempre dispara — user não pode optar fora).
 */
export interface SendBroadcastParams {
  sentBy: string;
  title: string;
  body: string | null;
  link: string | null;
  /** Texto do botão CTA quando há link (default "Saiba mais"). */
  linkLabel?: string | null;
  audience: BroadcastAudience;
  /** Canais de entrega — pelo menos 1 deve ser true. */
  deliverPush?: boolean;
  deliverInapp?: boolean;
  deliverBanner?: boolean;
  /** Quando setado, banner some pra todos depois desta data. */
  bannerExpiresAt?: string | null;
  /** Popup full-screen no próximo acesso (1× por aluno via broadcast_popup_seen). */
  deliverPopup?: boolean;
  /** URL da imagem que aparece no topo do popup (opcional). */
  popupImageUrl?: string | null;
}

export async function sendBroadcast(params: SendBroadcastParams): Promise<{
  broadcastId: string;
  recipientsCount: number;
  delivered: number;
  failed: number;
}> {
  const admin = createAdminClient();
  const userIds = await resolveBroadcastAudience(params.audience);

  const deliverPush = params.deliverPush !== false;
  const deliverInapp = params.deliverInapp !== false;
  const deliverBanner = params.deliverBanner === true;
  const deliverPopup = params.deliverPopup === true;

  if (!deliverPush && !deliverInapp && !deliverBanner && !deliverPopup) {
    throw new Error("Selecione pelo menos um canal de entrega.");
  }

  // Cria registro de broadcast
  const { data: bc, error: bcErr } = await admin
    .schema("membros")
    .from("push_broadcasts")
    .insert({
      sent_by: params.sentBy,
      title: params.title,
      body: params.body,
      link: params.link,
      link_label: params.linkLabel ?? null,
      audience: params.audience,
      recipients_count: userIds.length,
      deliver_push: deliverPush,
      deliver_inapp: deliverInapp,
      deliver_banner: deliverBanner,
      banner_expires_at: params.bannerExpiresAt ?? null,
      deliver_popup: deliverPopup,
      image_url: params.popupImageUrl ?? null,
    })
    .select("id")
    .single();

  if (bcErr || !bc) {
    throw new Error(bcErr?.message ?? "Falha ao criar broadcast.");
  }
  const broadcastId = (bc as { id: string }).id;

  if (userIds.length === 0) {
    return { broadcastId, recipientsCount: 0, delivered: 0, failed: 0 };
  }

  // In-app: cria notif (sino do topbar)
  if (deliverInapp) {
    const notifications = userIds.map((uid) => ({
      user_id: uid,
      title: params.title,
      body: params.body,
      link: params.link,
    }));
    await admin.schema("membros").from("notifications").insert(notifications);
  }

  // Push: dispara em batches pra não estourar mem
  let delivered = 0;
  let failed = 0;
  if (deliverPush) {
    const BATCH = 50;
    for (let i = 0; i < userIds.length; i += BATCH) {
      const batch = userIds.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((uid) =>
          sendPushToUser({
            userId: uid,
            category: "broadcast",
            payload: {
              title: params.title,
              body: params.body ?? undefined,
              link: params.link ?? undefined,
              tag: `broadcast-${broadcastId}`,
            },
          }).catch(() => ({ delivered: 0, failed: 1 })),
        ),
      );
      for (const r of results) {
        delivered += r.delivered;
        failed += r.failed;
      }
    }
  }

  // Banner: nada a fazer aqui — a row já foi criada com deliver_banner=true.
  // Cada page-load do aluno consulta active banners e renderiza no layout.

  // Atualiza contadores
  await admin
    .schema("membros")
    .from("push_broadcasts")
    .update({ delivered_count: delivered, failed_count: failed })
    .eq("id", broadcastId);

  return {
    broadcastId,
    recipientsCount: userIds.length,
    delivered,
    failed,
  };
}

export interface ActiveBanner {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  linkLabel: string | null;
  bannerExpiresAt: string | null;
}

/**
 * Retorna broadcasts ativos com `deliver_banner=true` que esse user é
 * elegível E ainda NÃO dispensou. Usado pelo `<BroadcastBanners>` no
 * student layout pra renderizar a barra fixa no topo.
 *
 * Filtros:
 *   - deliver_banner = true
 *   - banner_expires_at IS NULL OR banner_expires_at > now()
 *   - user_id NÃO está em user_dismissed_broadcasts(broadcast_id)
 *   - user é elegível pela audiência (resolve via resolveBroadcastAudience)
 *
 * Performance: pra MVP roda 1 query simples e filtra em memory. Quando
 * tiver volume, dá pra otimizar com view materializada por user.
 */
export async function getActiveBannersForUser(
  userId: string,
): Promise<ActiveBanner[]> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Banners ativos (não expiraram E não dispensados pelo user)
  const { data: rows } = await admin
    .schema("membros")
    .from("push_broadcasts")
    .select(
      "id, title, body, link, link_label, audience, banner_expires_at, created_at",
    )
    .eq("deliver_banner", true)
    .or(`banner_expires_at.is.null,banner_expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(20);

  const candidates = (rows ?? []) as Array<{
    id: string;
    title: string;
    body: string | null;
    link: string | null;
    link_label: string | null;
    audience: BroadcastAudience;
    banner_expires_at: string | null;
  }>;

  if (candidates.length === 0) return [];

  // IDs dispensados pelo user
  const { data: dismissed } = await admin
    .schema("membros")
    .from("user_dismissed_broadcasts")
    .select("broadcast_id")
    .eq("user_id", userId);
  const dismissedSet = new Set(
    ((dismissed ?? []) as Array<{ broadcast_id: string }>).map(
      (d) => d.broadcast_id,
    ),
  );

  // Filtra: não dispensados E user na audiência
  const out: ActiveBanner[] = [];
  for (const bc of candidates) {
    if (dismissedSet.has(bc.id)) continue;
    const eligibleIds = await resolveBroadcastAudience(bc.audience);
    if (!eligibleIds.includes(userId)) continue;
    out.push({
      id: bc.id,
      title: bc.title,
      body: bc.body,
      link: bc.link,
      linkLabel: bc.link_label,
      bannerExpiresAt: bc.banner_expires_at,
    });
  }
  return out;
}

export interface PendingPopup {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  linkLabel: string | null;
  imageUrl: string | null;
}

/**
 * Retorna o próximo broadcast popup que o user ainda não viu, ou null.
 * Pega o mais antigo primeiro (fila FIFO) — assim popups antigos não
 * ficam pulando ordem.
 *
 * Filtros:
 *   - deliver_popup = true
 *   - user é elegível pela audiência
 *   - user_id+broadcast_id NÃO está em broadcast_popup_seen
 *
 * Usado pelo `<BroadcastPopupGate>` no student layout.
 */
export async function getNextPopupForUser(
  userId: string,
): Promise<PendingPopup | null> {
  const admin = createAdminClient();

  const { data: rows } = await admin
    .schema("membros")
    .from("push_broadcasts")
    .select(
      "id, title, body, link, link_label, image_url, audience, created_at",
    )
    .eq("deliver_popup", true)
    .order("created_at", { ascending: true })
    .limit(20);

  const candidates = (rows ?? []) as Array<{
    id: string;
    title: string;
    body: string | null;
    link: string | null;
    link_label: string | null;
    image_url: string | null;
    audience: BroadcastAudience;
  }>;

  if (candidates.length === 0) return null;

  const { data: seen } = await admin
    .schema("membros")
    .from("broadcast_popup_seen")
    .select("broadcast_id")
    .eq("user_id", userId);
  const seenSet = new Set(
    ((seen ?? []) as Array<{ broadcast_id: string }>).map((s) => s.broadcast_id),
  );

  for (const bc of candidates) {
    if (seenSet.has(bc.id)) continue;
    const eligibleIds = await resolveBroadcastAudience(bc.audience);
    if (!eligibleIds.includes(userId)) continue;
    return {
      id: bc.id,
      title: bc.title,
      body: bc.body,
      link: bc.link,
      linkLabel: bc.link_label,
      imageUrl: bc.image_url,
    };
  }
  return null;
}
