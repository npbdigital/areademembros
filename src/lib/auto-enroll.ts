/**
 * Lógica de auto-enroll a partir de eventos de compra.
 *
 * Lê de `membros.purchase_events` e atua:
 *  - Compra Aprovada → cria/reativa user (senha mudar123) + cria matrícula
 *  - Compra Reembolsada / Cancelada → desativa matrícula
 *
 * Idempotência:
 *  - purchase_events tem UNIQUE(transaction_row_id, event), então o trigger
 *    SQL nunca duplica entradas
 *  - Cada chamada marca `status` (processed/unmapped/failed) — só processa
 *    se status = 'pending'
 *
 * Toggle global: respeita platform_settings.auto_enrollment_enabled. Se
 * 'false', não faz nada (eventos ficam parados em pending até admin ativar).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { expiresAtFromDuration } from "@/lib/enrollment";

export const DEFAULT_STUDENT_PASSWORD = "mudar123";

interface PurchaseEventRow {
  id: string;
  transaction_row_id: number;
  platform: string;
  event: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  product_name: string | null;
  status: string;
}

interface ProcessResult {
  ok: boolean;
  status: "processed" | "unmapped" | "failed" | "skipped";
  message?: string;
  cohortId?: string;
  userId?: string;
  enrollmentId?: string;
}

/**
 * Verifica se o auto-enroll está ativado globalmente.
 */
export async function isAutoEnrollmentEnabled(
  sb: SupabaseClient,
): Promise<boolean> {
  const { data } = await sb
    .schema("membros")
    .from("platform_settings")
    .select("value")
    .eq("key", "auto_enrollment_enabled")
    .maybeSingle();
  return ((data as { value: string } | null)?.value ?? "false") === "true";
}

/**
 * Processa um evento de compra. Idempotente — chamadas repetidas no mesmo
 * id retornam early com `skipped` se já foi processado.
 */
export async function processPurchaseEvent(
  eventId: string,
): Promise<ProcessResult> {
  const sb = createAdminClient();

  const { data: row } = await sb
    .schema("membros")
    .from("purchase_events")
    .select(
      "id, transaction_row_id, platform, event, email, full_name, phone, product_name, status",
    )
    .eq("id", eventId)
    .maybeSingle();

  const ev = row as PurchaseEventRow | null;
  if (!ev) {
    return { ok: false, status: "failed", message: "Evento não encontrado." };
  }
  if (ev.status !== "pending") {
    return {
      ok: true,
      status: "skipped",
      message: `Já está em status=${ev.status}.`,
    };
  }

  // Toggle global
  const enabled = await isAutoEnrollmentEnabled(sb);
  if (!enabled) {
    return {
      ok: true,
      status: "skipped",
      message: "Auto-enrollment desativado globalmente.",
    };
  }

  // Reembolso/cancelamento: desativa enrollment
  if (
    ev.event === "Compra Reembolsada" ||
    ev.event === "Compra Cancelada"
  ) {
    return await handleAccessRevoke(sb, ev);
  }

  // Compra Aprovada: cria user + enrollment
  return await handleAccessGrant(sb, ev);
}

async function handleAccessGrant(
  sb: SupabaseClient,
  ev: PurchaseEventRow,
): Promise<ProcessResult> {
  const productName = (ev.product_name ?? "").trim().toLowerCase();
  if (!productName) {
    await markEvent(sb, ev.id, "failed", {
      message: "product_name vazio na venda.",
    });
    return { ok: false, status: "failed", message: "product_name vazio." };
  }

  // Busca mapeamento — case-insensitive (já guardamos lowercase)
  const { data: mapping } = await sb
    .schema("membros")
    .from("product_cohort_map")
    .select("cohort_id, default_expires_days")
    .eq("is_active", true)
    .ilike("product_name_pattern", productName)
    .maybeSingle();

  const m = mapping as
    | { cohort_id: string; default_expires_days: number | null }
    | null;
  if (!m || !m.cohort_id) {
    await markEvent(sb, ev.id, "unmapped", {
      message: `Produto "${productName}" sem mapeamento em product_cohort_map.`,
    });
    return {
      ok: false,
      status: "unmapped",
      message: `Produto "${productName}" sem mapeamento.`,
    };
  }

  // Pega duração da cohort (fallback se mapping não tem default_expires_days)
  const { data: cohort } = await sb
    .schema("membros")
    .from("cohorts")
    .select("id, default_duration_days")
    .eq("id", m.cohort_id)
    .maybeSingle();
  const c = cohort as { id: string; default_duration_days: number | null } | null;
  if (!c) {
    await markEvent(sb, ev.id, "failed", {
      message: `Cohort ${m.cohort_id} mapeada não existe mais.`,
    });
    return { ok: false, status: "failed", message: "Cohort não existe." };
  }

  const durationDays = m.default_expires_days ?? c.default_duration_days;
  const expiresAt = expiresAtFromDuration(durationDays);

  // Resolve user (cria se não existe, com senha padrão mudar123)
  const userResolution = await resolveOrCreateUser(sb, {
    email: ev.email,
    fullName: ev.full_name,
    phone: ev.phone,
  });
  if (!userResolution.ok) {
    await markEvent(sb, ev.id, "failed", { message: userResolution.message });
    return {
      ok: false,
      status: "failed",
      message: userResolution.message,
    };
  }

  // Cria/reativa enrollment
  const { data: existingEnroll } = await sb
    .schema("membros")
    .from("enrollments")
    .select("id")
    .eq("user_id", userResolution.userId)
    .eq("cohort_id", m.cohort_id)
    .maybeSingle();

  let enrollmentId: string;
  if (existingEnroll) {
    enrollmentId = (existingEnroll as { id: string }).id;
    const { error } = await sb
      .schema("membros")
      .from("enrollments")
      .update({
        is_active: true,
        expires_at: expiresAt,
        enrolled_at: new Date().toISOString(),
        source: "webhook",
      })
      .eq("id", enrollmentId);
    if (error) {
      await markEvent(sb, ev.id, "failed", {
        message: `Falha ao reativar enrollment: ${error.message}`,
      });
      return { ok: false, status: "failed", message: error.message };
    }
  } else {
    const { data: created, error } = await sb
      .schema("membros")
      .from("enrollments")
      .insert({
        user_id: userResolution.userId,
        cohort_id: m.cohort_id,
        expires_at: expiresAt,
        source: "webhook",
        is_active: true,
      })
      .select("id")
      .single();
    if (error || !created) {
      await markEvent(sb, ev.id, "failed", {
        message: `Falha ao criar enrollment: ${error?.message ?? "?"}`,
      });
      return {
        ok: false,
        status: "failed",
        message: error?.message ?? "Falha enrollment.",
      };
    }
    enrollmentId = (created as { id: string }).id;
  }

  await markEvent(sb, ev.id, "processed", {
    cohortId: m.cohort_id,
    userId: userResolution.userId,
    enrollmentId,
  });

  return {
    ok: true,
    status: "processed",
    cohortId: m.cohort_id,
    userId: userResolution.userId,
    enrollmentId,
  };
}

async function handleAccessRevoke(
  sb: SupabaseClient,
  ev: PurchaseEventRow,
): Promise<ProcessResult> {
  const productName = (ev.product_name ?? "").trim().toLowerCase();

  // Acha o user pelo email
  const { data: userRow } = await sb
    .schema("membros")
    .from("users")
    .select("id")
    .ilike("email", ev.email)
    .maybeSingle();
  const u = userRow as { id: string } | null;
  if (!u) {
    // User nem existe — provavelmente comprou em plataforma antiga, ignora
    await markEvent(sb, ev.id, "skipped", {
      message: "Aluno não tem cadastro na plataforma — nada a desativar.",
    });
    return { ok: true, status: "skipped" };
  }

  // Busca cohort do produto
  const { data: mapping } = await sb
    .schema("membros")
    .from("product_cohort_map")
    .select("cohort_id")
    .eq("is_active", true)
    .ilike("product_name_pattern", productName)
    .maybeSingle();
  const m = mapping as { cohort_id: string } | null;

  if (!m) {
    // Sem mapeamento, não sabemos qual enrollment desativar
    await markEvent(sb, ev.id, "unmapped", {
      message: `Reembolso de "${productName}" mas produto sem mapeamento.`,
    });
    return { ok: false, status: "unmapped" };
  }

  // Desativa enrollment do user nessa cohort
  const { error } = await sb
    .schema("membros")
    .from("enrollments")
    .update({ is_active: false })
    .eq("user_id", u.id)
    .eq("cohort_id", m.cohort_id);
  if (error) {
    await markEvent(sb, ev.id, "failed", { message: error.message });
    return { ok: false, status: "failed", message: error.message };
  }

  await markEvent(sb, ev.id, "processed", {
    cohortId: m.cohort_id,
    userId: u.id,
  });
  return { ok: true, status: "processed", cohortId: m.cohort_id, userId: u.id };
}

interface ResolveUserResult {
  ok: boolean;
  userId: string;
  created: boolean;
  message?: string;
}

async function resolveOrCreateUser(
  sb: SupabaseClient,
  params: {
    email: string;
    fullName: string | null;
    phone: string | null;
  },
): Promise<ResolveUserResult> {
  const email = params.email.trim().toLowerCase();

  // Lista users do auth pra ver se já existe
  // (auth.admin.listUsers tem paginação; pra base grande não escala. Usamos
  // membros.users como índice — ela é populada por triggers ou por outras
  // partes do sistema. Se o user existe lá, reutilizamos o id.)
  const { data: profileRow } = await sb
    .schema("membros")
    .from("users")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();
  const p = profileRow as { id: string; email: string } | null;
  if (p) {
    // Atualiza nome/phone se vieram preenchidos no payload
    const updates: Record<string, unknown> = { is_active: true };
    if (params.fullName) updates.full_name = params.fullName;
    if (params.phone) updates.phone = params.phone;
    await sb.schema("membros").from("users").update(updates).eq("id", p.id);
    return { ok: true, userId: p.id, created: false };
  }

  // Não tem profile — tenta criar no auth. Se já existir lá (edge case),
  // o catch trata via listUsers. supabase-js define o tipo correto pra
  // auth.admin.createUser na própria SupabaseClient já tipada.
  const { data: created, error: createErr } =
    await sb.auth.admin.createUser({
      email,
      password: DEFAULT_STUDENT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: params.fullName ?? null,
        phone: params.phone ?? null,
      },
    });

  if (createErr) {
    // Se for "already registered", busca via listUsers (1 chamada paginada)
    if (
      createErr.message.toLowerCase().includes("already") ||
      createErr.message.toLowerCase().includes("registered")
    ) {
      const { data: listResult } = await sb.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const found = listResult.users?.find(
        (u) => u.email?.toLowerCase() === email,
      );
      if (found) {
        // Sincroniza profile
        await sb
          .schema("membros")
          .from("users")
          .upsert(
            {
              id: found.id,
              email,
              full_name: params.fullName ?? null,
              phone: params.phone ?? null,
              role: "student",
              is_active: true,
            },
            { onConflict: "id" },
          );
        return { ok: true, userId: found.id, created: false };
      }
    }
    return {
      ok: false,
      userId: "",
      created: false,
      message: `Falha ao criar user: ${createErr.message}`,
    };
  }

  if (!created?.user) {
    return {
      ok: false,
      userId: "",
      created: false,
      message: "Resposta de createUser sem user.",
    };
  }

  const userId = created.user.id;

  // Cria o profile na schema membros
  await sb
    .schema("membros")
    .from("users")
    .upsert(
      {
        id: userId,
        email,
        full_name: params.fullName ?? null,
        phone: params.phone ?? null,
        role: "student",
        is_active: true,
      },
      { onConflict: "id" },
    );

  return { ok: true, userId, created: true };
}

async function markEvent(
  sb: SupabaseClient,
  eventId: string,
  status: "processed" | "unmapped" | "failed" | "skipped",
  meta: {
    message?: string;
    cohortId?: string;
    userId?: string;
    enrollmentId?: string;
  },
) {
  const updates: Record<string, unknown> = {
    status,
    processed_at: new Date().toISOString(),
  };
  if (meta.message) updates.error_message = meta.message;
  if (meta.cohortId) updates.matched_cohort_id = meta.cohortId;
  if (meta.userId) updates.user_id = meta.userId;
  if (meta.enrollmentId) updates.enrollment_id = meta.enrollmentId;
  await sb
    .schema("membros")
    .from("purchase_events")
    .update(updates)
    .eq("id", eventId);
}
