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
import {
  inviteEmailHtml,
  newAccessEmailHtml,
  sendEmail,
} from "@/lib/email/resend";
import { getPlatformSettings } from "@/lib/settings";

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

  // Lock atômico: tenta marcar status pending -> processing. Se retornar
  // 0 linhas, significa que outra execução pegou primeiro (cron + webhook
  // do Supabase + retry manual podem rodar em paralelo). Sai sem fazer
  // nada — evita race condition e double-INSERT no enrollment.
  //
  // Setamos processed_at=now() no lock pra servir de "ultimo heartbeat":
  // se a serverless crashar entre o lock e o markEvent final, o recovery
  // do cron usa processed_at < 5min ago como sinal de evento travado.
  // Quando o markEvent final roda, processed_at é sobrescrito com o
  // timestamp final — semantica nao quebra (status discrimina os casos).
  const { data: locked } = await sb
    .schema("membros")
    .from("purchase_events")
    .update({ status: "processing", processed_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("status", "pending")
    .select(
      "id, transaction_row_id, platform, event, email, full_name, phone, product_name, status",
    )
    .maybeSingle();

  const ev = locked as PurchaseEventRow | null;
  if (!ev) {
    // Buscar o estado atual só pra dar uma resposta informativa
    const { data: cur } = await sb
      .schema("membros")
      .from("purchase_events")
      .select("status")
      .eq("id", eventId)
      .maybeSingle();
    const curStatus = (cur as { status: string } | null)?.status ?? "?";
    return {
      ok: true,
      status: "skipped",
      message:
        curStatus === "?"
          ? "Evento não encontrado."
          : `Já em status=${curStatus} (concorrência ou já processado).`,
    };
  }

  // Toggle global. Se desativado, devolve o status pra pending pra que,
  // quando admin reativar, o cron pegue de novo (em vez de ficar preso
  // em "processing"). Limpa processed_at (estava setado pelo lock como
  // heartbeat) — pending nao deve ter processed_at populado.
  const enabled = await isAutoEnrollmentEnabled(sb);
  if (!enabled) {
    await sb
      .schema("membros")
      .from("purchase_events")
      .update({ status: "pending", processed_at: null })
      .eq("id", ev.id);
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

  // Pega duração + nome da cohort. Nome vai pro email "novo acesso liberado"
  // pra aluno saber qual produto/turma ele acabou de comprar.
  const { data: cohort } = await sb
    .schema("membros")
    .from("cohorts")
    .select("id, name, default_duration_days")
    .eq("id", m.cohort_id)
    .maybeSingle();
  const c = cohort as
    | { id: string; name: string; default_duration_days: number | null }
    | null;
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

  // UPSERT idempotente — usa a unique constraint (user_id, cohort_id) pra
  // evitar race conditions. Antes usavamos SELECT-then-INSERT, mas duas
  // execuçoes paralelas (cron + webhook + retry) podiam ler "nao existe"
  // ao mesmo tempo e ambas tentar INSERT, batendo no duplicate key.
  const { data: upserted, error: enrollErr } = await sb
    .schema("membros")
    .from("enrollments")
    .upsert(
      {
        user_id: userResolution.userId,
        cohort_id: m.cohort_id,
        expires_at: expiresAt,
        source: "webhook",
        is_active: true,
        enrolled_at: new Date().toISOString(),
      },
      { onConflict: "user_id,cohort_id" },
    )
    .select("id")
    .single();

  if (enrollErr || !upserted) {
    await markEvent(sb, ev.id, "failed", {
      message: `Falha ao criar enrollment: ${enrollErr?.message ?? "?"}`,
    });
    return {
      ok: false,
      status: "failed",
      message: enrollErr?.message ?? "Falha no upsert.",
    };
  }
  const enrollmentId = (upserted as { id: string }).id;

  await markEvent(sb, ev.id, "processed", {
    cohortId: m.cohort_id,
    userId: userResolution.userId,
    enrollmentId,
  });

  // Dispara email apropriado (boas-vindas inicial OU "novo acesso liberado").
  // Decisao + idempotencia ficam dentro do helper. Await pra garantir que
  // sai antes da serverless terminar. Erro nao derruba — aluno ja matriculado.
  try {
    await sendEnrollmentEmail({
      userId: userResolution.userId,
      enrollmentId,
      cohortName: c.name,
      email: ev.email,
      fullName: ev.full_name,
      eventId: ev.id,
    });
  } catch (e) {
    console.error("[auto-enroll] falha enviando email", ev.id, e);
  }

  return {
    ok: true,
    status: "processed",
    cohortId: m.cohort_id,
    userId: userResolution.userId,
    enrollmentId,
  };
}

/**
 * Decide e dispara o email correto pra aluno recem matriculado:
 *
 *   - 1ª compra do aluno (users.welcome_email_sent_at IS NULL)
 *     -> email INICIAL com senha "mudar123" + CTA pro auto-login.
 *
 *   - 2ª+ compra (users.welcome_email_sent_at JA preenchido) e enrollment
 *     novo (enrollments.welcome_email_sent_at IS NULL)
 *     -> email "NOVO ACESSO LIBERADO" sem senha, citando o nome da turma.
 *
 *   - Reprocessamento de venda ja avisada (enrollments.welcome_email_sent_at
 *     IS NOT NULL)
 *     -> nao envia nada.
 *
 * Idempotencia por LOCK ATOMICO: UPDATE WHERE coluna IS NULL retornando
 * a linha. Se duas execucoes paralelas chamarem ao mesmo tempo, so a
 * primeira efetivamente atualiza — a segunda enxerga 0 linhas e pula.
 *
 * Em caso de falha no Resend, reverte o timestamp pra que retry futuro
 * tente de novo (em vez de ficar marcado mas sem ter saido).
 */
async function sendEnrollmentEmail(params: {
  userId: string;
  enrollmentId: string;
  cohortName: string;
  email: string;
  fullName: string | null;
  eventId: string;
}): Promise<void> {
  const sb = createAdminClient();

  // Tenta lock no LEVEL 1 (email inicial com senha). Se UPDATE pegou,
  // esse aluno nunca recebeu nada antes — manda o welcome completo.
  const { data: userMarked } = await sb
    .schema("membros")
    .from("users")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", params.userId)
    .is("welcome_email_sent_at", null)
    .select("id")
    .maybeSingle();

  const settings = await getPlatformSettings(sb);
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://membros.felipesempe.com.br";
  const loginUrl = `${origin}/auto-login?e=${encodeURIComponent(params.email)}&p=${encodeURIComponent(DEFAULT_STUDENT_PASSWORD)}`;

  if (userMarked) {
    // LEVEL 1: email inicial com senha
    const html = inviteEmailHtml({
      fullName: params.fullName ?? "novo aluno",
      email: params.email,
      password: DEFAULT_STUDENT_PASSWORD,
      loginUrl,
      platformName: settings.platformName,
      platformLogoUrl: settings.platformLogoUrl,
    });

    const result = await sendEmail({
      to: params.email,
      subject: `Seu acesso à ${settings.platformName} está pronto`,
      html,
    });

    if (!result.ok) {
      console.error(
        "[auto-enroll] welcome inicial falhou — revertendo flag",
        params.eventId,
        result.error,
      );
      await sb
        .schema("membros")
        .from("users")
        .update({ welcome_email_sent_at: null })
        .eq("id", params.userId);
    } else {
      // Marca tambem esse enrollment como ja "avisado", pra nao mandar
      // o email de "novo acesso" depois redundante. O 1o email ja menciona
      // o produto que ele comprou no contexto da plataforma.
      await sb
        .schema("membros")
        .from("enrollments")
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq("id", params.enrollmentId);
    }
    return;
  }

  // LEVEL 2: aluno ja recebeu o welcome inicial em outra venda. Tenta
  // lock no enrollment — se conseguir, manda email de "novo acesso".
  const { data: enrollMarked } = await sb
    .schema("membros")
    .from("enrollments")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", params.enrollmentId)
    .is("welcome_email_sent_at", null)
    .select("id")
    .maybeSingle();

  if (!enrollMarked) {
    // Esse enrollment ja foi avisado anteriormente — nao manda nada.
    return;
  }

  // Email "novo acesso liberado" — sem senha, citando a turma.
  const html = newAccessEmailHtml({
    fullName: params.fullName ?? "aluno",
    cohortName: params.cohortName,
    loginUrl,
    platformName: settings.platformName,
    platformLogoUrl: settings.platformLogoUrl,
  });

  const result = await sendEmail({
    to: params.email,
    subject: `Novo acesso liberado: ${params.cohortName}`,
    html,
  });

  if (!result.ok) {
    console.error(
      "[auto-enroll] novo-acesso falhou — revertendo flag",
      params.eventId,
      result.error,
    );
    await sb
      .schema("membros")
      .from("enrollments")
      .update({ welcome_email_sent_at: null })
      .eq("id", params.enrollmentId);
  }
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

  // Anti-revoga-erronea: se existe uma Compra Aprovada do mesmo cohort
  // com created_at POSTERIOR a esse cancelamento, ignora — o aluno
  // recomprou depois e tem direito ao acesso. Caso comum: PIX Hubla
  // expirado processado dias depois da compra Kiwify aprovada.
  // Reembolso real (created_at posterior à aprovação) continua desativando.
  const { data: thisEv } = await sb
    .schema("membros")
    .from("purchase_events")
    .select("created_at")
    .eq("id", ev.id)
    .single();
  const cancelCreatedAt = (thisEv as { created_at: string } | null)?.created_at;

  if (cancelCreatedAt) {
    const { count: laterApprovals } = await sb
      .schema("membros")
      .from("purchase_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", u.id)
      .eq("matched_cohort_id", m.cohort_id)
      .eq("event", "Compra Aprovada")
      .eq("status", "processed")
      .gt("created_at", cancelCreatedAt);

    if ((laterApprovals ?? 0) > 0) {
      await markEvent(sb, ev.id, "skipped", {
        message:
          "Cancelamento ignorado: aluno tem compra aprovada posterior do mesmo produto.",
        cohortId: m.cohort_id,
        userId: u.id,
      });
      return { ok: true, status: "skipped", cohortId: m.cohort_id, userId: u.id };
    }
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
