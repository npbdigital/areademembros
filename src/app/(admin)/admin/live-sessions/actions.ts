"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { tryNotifyMany } from "@/lib/notifications";

export type ActionResult<T = unknown> = {
  ok: boolean;
  error?: string;
  data?: T;
};

type Recurrence = "none" | "daily" | "weekly" | "biweekly" | "monthly";

const VALID_RECURRENCES: Recurrence[] = [
  "none",
  "daily",
  "weekly",
  "biweekly",
  "monthly",
];

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
  if ((profile as { role?: string } | null)?.role !== "admin") {
    throw new Error("Sem permissão.");
  }
  return user.id;
}

function strField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableStr(formData: FormData, key: string): string | null {
  const v = strField(formData, key);
  return v === "" ? null : v;
}

/**
 * Parser de horário do form (input datetime-local). Sem timezone explícito,
 * assume BRT (-03:00) — alinhado com o resto da plataforma e display.
 */
function parseFormDateTime(raw: string | null): string | null {
  if (!raw) return null;
  const withTz = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : raw + "-03:00";
  const d = new Date(withTz);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Calcula próxima ocorrência somando o intervalo de recorrência, garantindo
 * que cai no FUTURO. Mantém o "ritmo" original (mesmo dia da semana, mesma
 * hora) — ex: monitoria toda segunda 19h. Se admin encerra no domingo
 * (atrasada), próxima vira "segunda 19h" (próxima futura). Se encerra no
 * próprio dia, vira a segunda da semana seguinte.
 *
 * Mensal usa setMonth (Date cuida de meses curtos automaticamente).
 */
function nextOccurrence(iso: string, recurrence: Recurrence): string | null {
  if (recurrence === "none") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const advance = () => {
    switch (recurrence) {
      case "daily":
        d.setDate(d.getDate() + 1);
        break;
      case "weekly":
        d.setDate(d.getDate() + 7);
        break;
      case "biweekly":
        d.setDate(d.getDate() + 14);
        break;
      case "monthly":
        d.setMonth(d.getMonth() + 1);
        break;
    }
  };

  // Avança pelo menos 1x. Continua avançando enquanto < agora pra sempre
  // cair no futuro (cobre o caso de admin encerrar várias semanas depois).
  advance();
  const now = Date.now();
  let safety = 200; // proteção contra loop infinito (200 iterações = 4 anos diários)
  while (d.getTime() <= now && safety-- > 0) {
    advance();
  }
  return d.toISOString();
}

function parseCohortIds(formData: FormData): string[] {
  return formData
    .getAll("cohort_ids")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
}

function parseRecurrence(formData: FormData): Recurrence {
  const v = strField(formData, "recurrence");
  return VALID_RECURRENCES.includes(v as Recurrence)
    ? (v as Recurrence)
    : "none";
}

function parseDuration(formData: FormData): number {
  const raw = strField(formData, "duration_minutes");
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 90;
  return Math.min(480, Math.max(15, n));
}

/** Cria uma monitoria + linhas na junção pra cada cohort selecionada. */
export async function createLiveSessionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const adminId = await assertAdmin();
    const sb = createAdminClient();

    const cohortIds = parseCohortIds(formData);
    const title = strField(formData, "title");
    const description = nullableStr(formData, "description");
    const scheduledAt = parseFormDateTime(nullableStr(formData, "scheduled_at"));
    const durationMinutes = parseDuration(formData);
    const zoomMeetingId = strField(formData, "zoom_meeting_id");
    const zoomPassword = nullableStr(formData, "zoom_password");
    const recurrence = parseRecurrence(formData);

    if (cohortIds.length === 0)
      return { ok: false, error: "Selecione pelo menos uma turma." };
    if (!title) return { ok: false, error: "Título é obrigatório." };
    if (!zoomMeetingId)
      return { ok: false, error: "Meeting ID do Zoom é obrigatório." };
    if (!scheduledAt) {
      return {
        ok: false,
        error:
          "Horário previsto é obrigatório (status vira AO VIVO automaticamente nele).",
      };
    }

    const { data, error } = await sb
      .schema("membros")
      .from("live_sessions")
      .insert({
        title,
        description,
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
        zoom_meeting_id: zoomMeetingId.replace(/\s/g, ""),
        zoom_password: zoomPassword,
        status: "scheduled",
        recurrence,
        created_by: adminId,
      })
      .select("id")
      .single();
    if (error || !data)
      return { ok: false, error: error?.message ?? "Falha ao criar." };
    const sessionId = (data as { id: string }).id;

    // Insere as cohorts associadas
    const { error: linkErr } = await sb
      .schema("membros")
      .from("live_session_cohorts")
      .insert(cohortIds.map((cid) => ({ session_id: sessionId, cohort_id: cid })));
    if (linkErr) {
      // rollback manual — exclui a session que ficou sem cohort
      await sb
        .schema("membros")
        .from("live_sessions")
        .delete()
        .eq("id", sessionId);
      return { ok: false, error: linkErr.message };
    }

    revalidatePath("/admin/live-sessions");
    revalidatePath("/monitorias", "layout");
    return { ok: true, data: { id: sessionId } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Atualiza dados (substitui cohorts, não muda status). */
export async function updateLiveSessionAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = createAdminClient();

    const cohortIds = parseCohortIds(formData);
    const title = strField(formData, "title");
    const description = nullableStr(formData, "description");
    const scheduledAt = parseFormDateTime(nullableStr(formData, "scheduled_at"));
    const durationMinutes = parseDuration(formData);
    const zoomMeetingId = strField(formData, "zoom_meeting_id");
    const zoomPassword = nullableStr(formData, "zoom_password");
    const recurrence = parseRecurrence(formData);

    if (cohortIds.length === 0)
      return { ok: false, error: "Selecione pelo menos uma turma." };
    if (!title) return { ok: false, error: "Título é obrigatório." };
    if (!zoomMeetingId)
      return { ok: false, error: "Meeting ID do Zoom é obrigatório." };
    if (!scheduledAt) {
      return { ok: false, error: "Horário previsto é obrigatório." };
    }

    const { error } = await sb
      .schema("membros")
      .from("live_sessions")
      .update({
        title,
        description,
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
        zoom_meeting_id: zoomMeetingId.replace(/\s/g, ""),
        zoom_password: zoomPassword,
        recurrence,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    // Substitui as cohorts (delete tudo + reinsere)
    await sb
      .schema("membros")
      .from("live_session_cohorts")
      .delete()
      .eq("session_id", id);
    const { error: linkErr } = await sb
      .schema("membros")
      .from("live_session_cohorts")
      .insert(cohortIds.map((cid) => ({ session_id: id, cohort_id: cid })));
    if (linkErr) return { ok: false, error: linkErr.message };

    revalidatePath("/admin/live-sessions");
    revalidatePath("/monitorias", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/**
 * Cancela monitoria — override manual. Status no DB vira 'cancelled' e
 * a derivação computeLiveStatus respeita esse override absoluto. Use pra
 * cancelar antes do horário ou interromper antes do tempo previsto.
 */
export async function cancelLiveSessionAction(
  id: string,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = createAdminClient();

    const nowIso = new Date().toISOString();
    const { error } = await sb
      .schema("membros")
      .from("live_sessions")
      .update({
        status: "cancelled",
        ended_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/live-sessions");
    revalidatePath("/monitorias", "layout");
    revalidatePath(`/monitorias/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/**
 * Cria a próxima ocorrência de uma série recorrente. Chamado pelo cron
 * quando a sessão atual termina (computado por scheduled_at + duration).
 * Idempotente via flag `successor_created_at`.
 *
 * Exportado pra reuso no cron — não é uma server action propriamente.
 */
export async function generateNextRecurrenceIfNeeded(
  id: string,
): Promise<{ nextSessionId: string | null }> {
  const sb = createAdminClient();

  const { data: sessionRow } = await sb
    .schema("membros")
    .from("live_sessions")
    .select(
      "id, title, description, scheduled_at, duration_minutes, zoom_meeting_id, zoom_password, status, recurrence, successor_created_at, created_by",
    )
    .eq("id", id)
    .maybeSingle();
  const session = sessionRow as
    | {
        id: string;
        title: string;
        description: string | null;
        scheduled_at: string | null;
        duration_minutes: number | null;
        zoom_meeting_id: string;
        zoom_password: string | null;
        status: string;
        recurrence: Recurrence;
        successor_created_at: string | null;
        created_by: string | null;
      }
    | null;
  if (!session) return { nextSessionId: null };
  if (session.successor_created_at) return { nextSessionId: null };
  if (session.recurrence === "none" || !session.scheduled_at) {
    return { nextSessionId: null };
  }
  if (session.status === "cancelled") return { nextSessionId: null };

  const nextScheduled = nextOccurrence(session.scheduled_at, session.recurrence);
  if (!nextScheduled) return { nextSessionId: null };

  // Pega cohorts da session original
  const { data: linkRows } = await sb
    .schema("membros")
    .from("live_session_cohorts")
    .select("cohort_id")
    .eq("session_id", id);
  const cohortIds = ((linkRows ?? []) as Array<{ cohort_id: string }>).map(
    (r) => r.cohort_id,
  );
  if (cohortIds.length === 0) return { nextSessionId: null };

  const { data: nextRow, error: insErr } = await sb
    .schema("membros")
    .from("live_sessions")
    .insert({
      title: session.title,
      description: session.description,
      scheduled_at: nextScheduled,
      duration_minutes: session.duration_minutes ?? 90,
      zoom_meeting_id: session.zoom_meeting_id,
      zoom_password: session.zoom_password,
      status: "scheduled",
      recurrence: session.recurrence,
      created_by: session.created_by,
    })
    .select("id")
    .single();
  if (insErr || !nextRow) return { nextSessionId: null };

  const nextId = (nextRow as { id: string }).id;
  await sb
    .schema("membros")
    .from("live_session_cohorts")
    .insert(
      cohortIds.map((cid) => ({
        session_id: nextId,
        cohort_id: cid,
      })),
    );

  await sb
    .schema("membros")
    .from("live_sessions")
    .update({ successor_created_at: new Date().toISOString() })
    .eq("id", id);

  return { nextSessionId: nextId };
}

/**
 * Notifica alunos elegíveis pra essa sessão de que ela está AO VIVO.
 * Idempotente via flag `live_notified_at`. Exportado pra reuso no cron.
 */
export async function notifyLiveSessionStartedIfNeeded(
  id: string,
): Promise<{ notified: number }> {
  const sb = createAdminClient();

  const { data: sessionRow } = await sb
    .schema("membros")
    .from("live_sessions")
    .select("id, title, status, live_notified_at")
    .eq("id", id)
    .maybeSingle();
  const session = sessionRow as
    | {
        id: string;
        title: string;
        status: string;
        live_notified_at: string | null;
      }
    | null;
  if (!session) return { notified: 0 };
  if (session.live_notified_at) return { notified: 0 };
  if (session.status === "cancelled") return { notified: 0 };

  const { data: linkRows } = await sb
    .schema("membros")
    .from("live_session_cohorts")
    .select("cohort_id")
    .eq("session_id", id);
  const cohortIds = ((linkRows ?? []) as Array<{ cohort_id: string }>).map(
    (r) => r.cohort_id,
  );
  if (cohortIds.length === 0) return { notified: 0 };

  const { data: enrollments } = await sb
    .schema("membros")
    .from("enrollments")
    .select("user_id, expires_at")
    .in("cohort_id", cohortIds)
    .eq("is_active", true);
  const userIdsSet = new Set<string>();
  for (const e of (enrollments ?? []) as Array<{
    user_id: string;
    expires_at: string | null;
  }>) {
    if (e.expires_at === null || new Date(e.expires_at) > new Date()) {
      userIdsSet.add(e.user_id);
    }
  }
  const userIds = Array.from(userIdsSet);

  if (userIds.length > 0) {
    await tryNotifyMany(userIds, {
      title: "🔴 Monitoria ao vivo agora",
      body: session.title,
      link: `/monitorias/${id}`,
      pushCategory: "broadcast",
    });
  }

  await sb
    .schema("membros")
    .from("live_sessions")
    .update({ live_notified_at: new Date().toISOString() })
    .eq("id", id);

  return { notified: userIds.length };
}

export async function deleteLiveSessionAction(
  id: string,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = createAdminClient();
    const { error } = await sb
      .schema("membros")
      .from("live_sessions")
      .delete()
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/live-sessions");
    revalidatePath("/monitorias", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
