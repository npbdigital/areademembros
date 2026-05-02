/**
 * Processamento de eventos Kiwify (dupla verificação email + nome).
 *
 * Fluxo:
 *   1. Webhook salva em afiliados.sales_raw
 *   2. processSalesRaw(rawId) é chamado em background
 *   3. Pra cada commissioned_store tipo 'affiliate':
 *      - cria/atualiza afiliados.sales (idempotente via UNIQUE order×email)
 *      - se afiliado tem vinculação verificada com aquele email E nome bate,
 *        atribui XP e avalia conquistas
 *      - se email bate mas nome NÃO bate: sale fica órfã (member_user_id=null)
 *        e admin vê isso na UI pra resolver manual
 *   4. Marca raw como processed
 *
 * Reembolso/chargeback:
 *   - busca sales pelo external_order_id
 *   - atualiza status, reverte XP via amount negativo
 */

import { createAdminClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { awardXp } from "@/lib/gamification";
import { notifyAndEmail, tryNotify } from "@/lib/notifications";
import { normalizeEmail, normalizeName } from "@/lib/affiliates/normalize";

interface KiwifyStore {
  id?: string;
  type: "producer" | "coproducer" | "affiliate" | string;
  affiliate_id?: string | null;
  email?: string | null;
  custom_name?: string | null;
  value?: string | number | null;
}

interface KiwifyPayload {
  order_id?: string;
  order_status?: string;
  webhook_event_type?: string;
  approved_date?: string | null;
  refunded_at?: string | null;
  payment_method?: string | null;
  Product?: {
    product_id?: string;
    product_name?: string;
  } | null;
  Commissions?: {
    charge_amount?: string | number | null;
    currency?: string | null;
    commissioned_stores?: KiwifyStore[];
  } | null;
}

interface SalesRawRow {
  id: string;
  raw_payload: KiwifyPayload;
  webhook_event_type: string | null;
  order_id: string | null;
}

const REVERSAL_EVENTS = new Set([
  "order_refunded",
  "refunded",
  "chargeback",
  "chargedback",
  "order_chargedback",
]);

const APPROVED_EVENTS = new Set([
  "order_approved",
  "subscription_renewed",
]);

function toCents(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? Number.parseInt(v, 10) : Math.round(v);
  return Number.isFinite(n) ? n : 0;
}

function parseKiwifyDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function processSalesRaw(rawId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: rawRow, error: rawErr } = await supabase
    .schema("afiliados")
    .from("sales_raw")
    .select("id, raw_payload, webhook_event_type, order_id, processed")
    .eq("id", rawId)
    .maybeSingle();

  if (rawErr || !rawRow) {
    console.error("[kiwify process] raw não encontrado:", rawId, rawErr);
    return;
  }

  const raw = rawRow as SalesRawRow & { processed: boolean };
  const payload = raw.raw_payload;
  const eventType = (raw.webhook_event_type ?? "").toLowerCase();

  try {
    if (APPROVED_EVENTS.has(eventType)) {
      await processApproved(supabase, raw, payload);
    } else if (REVERSAL_EVENTS.has(eventType)) {
      await processReversal(supabase, raw, payload, eventType);
    }
  } catch (e) {
    console.error("[kiwify process] erro:", e);
  }

  await supabase
    .schema("afiliados")
    .from("sales_raw")
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq("id", rawId);
}

async function processApproved(
  supabase: SupabaseClient,
  raw: SalesRawRow,
  payload: KiwifyPayload,
): Promise<void> {
  const orderId = payload.order_id ?? raw.order_id;
  if (!orderId) {
    console.warn("[kiwify process] approved sem order_id");
    return;
  }

  const stores = payload.Commissions?.commissioned_stores ?? [];
  const productName = payload.Product?.product_name ?? null;
  const productId = payload.Product?.product_id ?? null;
  const grossCents = toCents(payload.Commissions?.charge_amount);
  const currency = payload.Commissions?.currency ?? "BRL";
  const approvedAt =
    parseKiwifyDate(payload.approved_date) ?? new Date().toISOString();

  for (const store of stores) {
    if (store.type !== "affiliate") continue;
    if (!store.email) continue;

    const emailNorm = normalizeEmail(store.email);
    const nameFromKiwify = store.custom_name ?? "";
    const commissionCents = toCents(store.value);

    // Procura vinculação por email (case-insensitive)
    const { data: linkRow } = await supabase
      .schema("afiliados")
      .from("affiliate_links")
      .select(
        "id, member_user_id, kiwify_email, kiwify_name, verified, verified_at, registered_at",
      )
      .eq("source", "kiwify")
      .ilike("kiwify_email", emailNorm)
      .maybeSingle();
    const link = linkRow as
      | {
          id: string;
          member_user_id: string;
          kiwify_email: string;
          kiwify_name: string;
          verified: boolean;
          verified_at: string | null;
          registered_at: string;
        }
      | null;

    // Verifica se nome bate (segundo fator)
    let nameMatches = false;
    if (link) {
      nameMatches =
        normalizeName(link.kiwify_name) === normalizeName(nameFromKiwify);
    }

    const shouldAttach = link !== null && nameMatches;

    // Upsert da venda (idempotência via UNIQUE source × order × email)
    const { data: saleRow, error: saleErr } = await supabase
      .schema("afiliados")
      .from("sales")
      .upsert(
        {
          raw_id: raw.id,
          source: "kiwify",
          external_order_id: orderId,
          kiwify_affiliate_id: store.affiliate_id ?? null,
          external_store_id: store.id ?? null,
          kiwify_email: emailNorm,
          kiwify_name: nameFromKiwify,
          member_user_id: shouldAttach && link ? link.member_user_id : null,
          product_name: productName,
          product_id: productId,
          status: "paid",
          payment_method: payload.payment_method ?? null,
          commission_value_cents: commissionCents,
          gross_value_cents: grossCents,
          currency,
          approved_at: approvedAt,
          status_updated_at: new Date().toISOString(),
        },
        {
          onConflict: "source,external_order_id,kiwify_email",
        },
      )
      .select("id, xp_awarded, member_user_id, status")
      .single();

    if (saleErr || !saleRow) {
      console.error("[kiwify process] erro upsert sale:", saleErr);
      continue;
    }

    const sale = saleRow as {
      id: string;
      xp_awarded: number;
      member_user_id: string | null;
      status: string;
    };

    // Sem vinculação → órfã
    if (!link) continue;

    // Email bate mas nome NÃO → notifica aluno (anti-spam 24h)
    if (!nameMatches) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: recentNotifs } = await supabase
        .schema("membros")
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", link.member_user_id)
        .ilike("title", "%nome no Kiwify%")
        .gte("created_at", since);

      if ((recentNotifs ?? 0) === 0) {
        await tryNotify({
          userId: link.member_user_id,
          title: "Nome no Kiwify não bate com o cadastrado",
          body: `Vimos uma venda chegando no email ${emailNorm}, mas o nome no Kiwify ("${nameFromKiwify}") é diferente do que você cadastrou ("${link.kiwify_name}"). Atualize seu perfil.`,
          link: "/profile#afiliado",
        });
      }
      continue;
    }

    // Venda anterior ao cadastro → não conta
    if (new Date(approvedAt) < new Date(link.registered_at)) continue;

    // Marca verified
    if (!link.verified) {
      await supabase
        .schema("afiliados")
        .from("affiliate_links")
        .update({
          verified: true,
          verified_at: new Date().toISOString(),
        })
        .eq("id", link.id);

      await notifyAndEmail({
        userId: link.member_user_id,
        title: "Vinculação Kiwify confirmada",
        body: "Sua primeira venda foi detectada! A partir de agora, vendas geram XP e desbloqueiam conquistas.",
        link: "/profile#afiliado",
        ctaLabel: "Ver meu perfil",
      });
    }

    // XP da venda
    if (sale.xp_awarded === 0 && sale.status === "paid") {
      const xpAmount = Math.floor(commissionCents / 100) + 10;
      try {
        await awardXp(supabase, {
          userId: link.member_user_id,
          amount: xpAmount,
          reason: "kiwify_sale",
          referenceId: sale.id,
        });
        await supabase
          .schema("afiliados")
          .from("sales")
          .update({ xp_awarded: xpAmount })
          .eq("id", sale.id);
      } catch (e) {
        console.error("[kiwify process] erro awardXp:", e);
      }
    }

    await evaluateKiwifyAchievements(supabase, link.member_user_id);
  }
}

async function processReversal(
  supabase: SupabaseClient,
  raw: SalesRawRow,
  payload: KiwifyPayload,
  eventType: string,
): Promise<void> {
  const orderId = payload.order_id ?? raw.order_id;
  if (!orderId) return;

  const newStatus = eventType.includes("chargeback")
    ? "chargedback"
    : "refunded";

  const { data: sales } = await supabase
    .schema("afiliados")
    .from("sales")
    .select("id, member_user_id, status, xp_awarded, product_name")
    .eq("source", "kiwify")
    .eq("external_order_id", orderId);

  for (const s of (sales ?? []) as Array<{
    id: string;
    member_user_id: string | null;
    status: string;
    xp_awarded: number;
    product_name: string | null;
  }>) {
    if (s.status === newStatus) continue;

    await supabase
      .schema("afiliados")
      .from("sales")
      .update({
        status: newStatus,
        status_updated_at: new Date().toISOString(),
      })
      .eq("id", s.id);

    if (s.xp_awarded > 0 && s.member_user_id) {
      try {
        await awardXp(supabase, {
          userId: s.member_user_id,
          amount: -s.xp_awarded,
          reason: "kiwify_sale_reversal",
          referenceId: s.id,
        });
        await supabase
          .schema("afiliados")
          .from("sales")
          .update({ xp_awarded: 0 })
          .eq("id", s.id);

        await tryNotify({
          userId: s.member_user_id,
          title:
            newStatus === "chargedback"
              ? "Venda revertida (chargeback)"
              : "Venda reembolsada",
          body: s.product_name ?? "Uma venda foi revertida.",
          link: "/profile#afiliado",
        });
      } catch (e) {
        console.error("[kiwify process] erro reverter XP:", e);
      }
    }
  }
}

async function evaluateKiwifyAchievements(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: salesData } = await supabase
    .schema("afiliados")
    .from("sales")
    .select("commission_value_cents")
    .eq("member_user_id", userId)
    .eq("status", "paid");

  const sales = (salesData ?? []) as Array<{ commission_value_cents: number }>;
  const salesCount = sales.length;
  const totalCommissionCents = sales.reduce(
    (sum, s) => sum + s.commission_value_cents,
    0,
  );

  const { data: achList } = await supabase
    .schema("membros")
    .from("achievements")
    .select("id, code, name, description, category, required_value, xp_reward")
    .in("category", ["sales_count", "sales_value"])
    .eq("is_active", true);

  const { data: unlocked } = await supabase
    .schema("membros")
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId);
  const unlockedIds = new Set(
    ((unlocked ?? []) as Array<{ achievement_id: string }>).map(
      (u) => u.achievement_id,
    ),
  );

  for (const ach of (achList ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    category: string;
    required_value: number;
    xp_reward: number;
  }>) {
    if (unlockedIds.has(ach.id)) continue;

    let achieved = false;
    if (ach.category === "sales_count") {
      achieved = salesCount >= ach.required_value;
    } else if (ach.category === "sales_value") {
      achieved = totalCommissionCents >= ach.required_value;
    }
    if (!achieved) continue;

    const { error: insErr } = await supabase
      .schema("membros")
      .from("user_achievements")
      .insert({ user_id: userId, achievement_id: ach.id });

    if (insErr) continue;

    if (ach.xp_reward > 0) {
      try {
        await awardXp(supabase, {
          userId,
          amount: ach.xp_reward,
          reason: "achievement_unlock",
          referenceId: ach.id,
        });
      } catch {
        // ignora
      }
    }

    await tryNotify({
      userId,
      title: `Conquista desbloqueada: ${ach.name}`,
      body:
        ach.description ??
        (ach.xp_reward > 0 ? `+${ach.xp_reward} XP` : null),
      link: "/profile#gamification",
    });
  }
}

/**
 * Backfill após cadastro: atribui vendas órfãs com email + nome batendo
 * (após registered_at).
 */
export async function backfillOrphanSales(
  kiwifyEmail: string,
  kiwifyName: string,
  memberUserId: string,
  registeredAt: string,
): Promise<number> {
  const supabase = createAdminClient();
  const emailNorm = normalizeEmail(kiwifyEmail);

  const { data: orphans } = await supabase
    .schema("afiliados")
    .from("sales")
    .select(
      "id, status, commission_value_cents, approved_at, xp_awarded, kiwify_name",
    )
    .eq("source", "kiwify")
    .ilike("kiwify_email", emailNorm)
    .is("member_user_id", null);

  let attached = 0;
  for (const s of (orphans ?? []) as Array<{
    id: string;
    status: string;
    commission_value_cents: number;
    approved_at: string | null;
    xp_awarded: number;
    kiwify_name: string | null;
  }>) {
    // Valida nome
    if (
      normalizeName(kiwifyName) !== normalizeName(s.kiwify_name ?? "")
    ) {
      continue;
    }

    if (s.approved_at && new Date(s.approved_at) < new Date(registeredAt)) {
      continue;
    }

    await supabase
      .schema("afiliados")
      .from("sales")
      .update({ member_user_id: memberUserId })
      .eq("id", s.id);
    attached++;

    if (s.status === "paid" && s.xp_awarded === 0) {
      const xpAmount = Math.floor(s.commission_value_cents / 100) + 10;
      try {
        await awardXp(supabase, {
          userId: memberUserId,
          amount: xpAmount,
          reason: "kiwify_sale",
          referenceId: s.id,
        });
        await supabase
          .schema("afiliados")
          .from("sales")
          .update({ xp_awarded: xpAmount })
          .eq("id", s.id);
      } catch {
        // ignora
      }
    }
  }

  if (attached > 0) {
    await evaluateKiwifyAchievements(createAdminClient(), memberUserId);
  }

  return attached;
}
