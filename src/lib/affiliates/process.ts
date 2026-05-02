/**
 * Processamento de eventos Kiwify.
 *
 * Fluxo:
 *   1. Webhook recebe payload → salva em afiliados.sales_raw
 *   2. processSalesRaw(rawId) é chamado em background
 *   3. Pra cada commissioned_store tipo 'affiliate':
 *      - cria/atualiza afiliados.sales (idempotente via UNIQUE)
 *      - se afiliado tem vinculação verificada e venda é após registered_at,
 *        atribui XP e avalia conquistas
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

interface KiwifyStore {
  id: string;
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
  // Kiwify manda "YYYY-MM-DD HH:mm" em alguns campos. Date constructor
  // brasileiro lida OK. Quando vier ISO completo (Subscription.start_date),
  // também funciona.
  const d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Processa um sales_raw novo. Idempotente — pode rodar várias vezes pra
 * mesmo raw e não duplica vendas (UNIQUE constraint).
 */
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
    // outros eventos (billet_created, pix_created etc.): ignoramos
  } catch (e) {
    console.error("[kiwify process] erro:", e);
    // não dispara throw — marca como processed mesmo com erro pra não loop
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
    if (!store.affiliate_id) continue;

    const externalAffiliateId = store.affiliate_id;
    const commissionCents = toCents(store.value);

    // Procura vinculação ativa
    const { data: linkRow } = await supabase
      .schema("afiliados")
      .from("affiliate_links")
      .select("id, member_user_id, verified, verified_at, registered_at")
      .eq("source", "kiwify")
      .eq("external_affiliate_id", externalAffiliateId)
      .maybeSingle();
    const link = linkRow as
      | {
          id: string;
          member_user_id: string;
          verified: boolean;
          verified_at: string | null;
          registered_at: string;
        }
      | null;

    // Upsert da venda (idempotência via UNIQUE)
    const { data: saleRow, error: saleErr } = await supabase
      .schema("afiliados")
      .from("sales")
      .upsert(
        {
          raw_id: raw.id,
          source: "kiwify",
          external_order_id: orderId,
          external_affiliate_id: externalAffiliateId,
          external_store_id: store.id ?? null,
          member_user_id: link?.member_user_id ?? null,
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
          onConflict: "source,external_order_id,external_affiliate_id",
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

    // Sem vinculação → fica órfã. Quando alguém vincular, o backfill atribui
    if (!link) continue;

    // Venda anterior ao cadastro → não conta
    if (new Date(approvedAt) < new Date(link.registered_at)) continue;

    // Marca verified se ainda não está
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

    // Atribui XP se ainda não atribuiu (idempotente via xp_awarded)
    if (sale.xp_awarded === 0 && sale.status === "paid") {
      const xpAmount = Math.floor(commissionCents / 100) + 10;
      // 1 XP por R$ + 10 XP fixo por venda
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

    // Avalia conquistas Kiwify
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

  // Busca todas as sales desse order_id (pode ter múltiplos affiliates)
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

    // Reverte XP
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

/**
 * Avalia conquistas das categorias 'sales_count' e 'sales_value' pro user.
 * Só desbloqueia (nunca revoga). XP da conquista vai pro xp_log.
 */
async function evaluateKiwifyAchievements(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  // Stats atuais (só vendas pagas — refundadas não contam pra conquistas)
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

  // Conquistas das 2 categorias relevantes
  const { data: achList } = await supabase
    .schema("membros")
    .from("achievements")
    .select("id, code, name, description, category, required_value, xp_reward")
    .in("category", ["sales_count", "sales_value"])
    .eq("is_active", true);

  // Já desbloqueadas
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

    // Insere desbloqueio
    const { error: insErr } = await supabase
      .schema("membros")
      .from("user_achievements")
      .insert({ user_id: userId, achievement_id: ach.id });

    if (insErr) continue; // race condition: outro processo desbloqueou primeiro

    // XP de bônus
    if (ach.xp_reward > 0) {
      try {
        await awardXp(supabase, {
          userId,
          amount: ach.xp_reward,
          reason: "achievement_unlock",
          referenceId: ach.id,
        });
      } catch {
        // ignora — XP é bônus
      }
    }

    // Notif
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
 * Backfill: quando aluno acabou de vincular, atribui vendas órfãs com aquele
 * external_affiliate_id (que aconteceram após registered_at) ao user_id dele.
 */
export async function backfillOrphanSales(
  externalAffiliateId: string,
  memberUserId: string,
  registeredAt: string,
): Promise<number> {
  const supabase = createAdminClient();
  const { data: orphans } = await supabase
    .schema("afiliados")
    .from("sales")
    .select("id, status, commission_value_cents, approved_at, xp_awarded")
    .eq("source", "kiwify")
    .eq("external_affiliate_id", externalAffiliateId)
    .is("member_user_id", null);

  let attached = 0;
  for (const s of (orphans ?? []) as Array<{
    id: string;
    status: string;
    commission_value_cents: number;
    approved_at: string | null;
    xp_awarded: number;
  }>) {
    // Só atribui vendas posteriores ao cadastro
    if (s.approved_at && new Date(s.approved_at) < new Date(registeredAt)) {
      continue;
    }

    await supabase
      .schema("afiliados")
      .from("sales")
      .update({ member_user_id: memberUserId })
      .eq("id", s.id);
    attached++;

    // Atribui XP retroativo (das vendas dentro do período)
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
