"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { tryNotifyMany } from "@/lib/notifications";

export type ActionResult<T = unknown> = {
  ok: boolean;
  error?: string;
  data?: T;
};

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

/** Cria uma monitoria. Status inicial = scheduled (não notifica). */
export async function createLiveSessionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const adminId = await assertAdmin();
    const sb = createAdminClient();

    const cohortId = strField(formData, "cohort_id");
    const title = strField(formData, "title");
    const description = nullableStr(formData, "description");
    const scheduledAtRaw = nullableStr(formData, "scheduled_at");
    const zoomMeetingId = strField(formData, "zoom_meeting_id");
    const zoomPassword = nullableStr(formData, "zoom_password");

    if (!cohortId) return { ok: false, error: "Turma é obrigatória." };
    if (!title) return { ok: false, error: "Título é obrigatório." };
    if (!zoomMeetingId)
      return { ok: false, error: "Meeting ID do Zoom é obrigatório." };

    // scheduled_at chega como datetime-local string ("2026-05-03T19:00")
    // Sem timezone — assume BRT (-03:00) pra alinhar com display
    let scheduledAt: string | null = null;
    if (scheduledAtRaw) {
      const withTz =
        /[Zz]$|[+-]\d{2}:?\d{2}$/.test(scheduledAtRaw)
          ? scheduledAtRaw
          : scheduledAtRaw + "-03:00";
      const d = new Date(withTz);
      if (!Number.isNaN(d.getTime())) scheduledAt = d.toISOString();
    }

    const { data, error } = await sb
      .schema("membros")
      .from("live_sessions")
      .insert({
        cohort_id: cohortId,
        title,
        description,
        scheduled_at: scheduledAt,
        zoom_meeting_id: zoomMeetingId.replace(/\s/g, ""),
        zoom_password: zoomPassword,
        status: "scheduled",
        created_by: adminId,
      })
      .select("id")
      .single();
    if (error || !data)
      return { ok: false, error: error?.message ?? "Falha ao criar." };

    revalidatePath("/admin/live-sessions");
    revalidatePath("/monitorias", "layout");
    return { ok: true, data: { id: (data as { id: string }).id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Atualiza dados (não muda status). */
export async function updateLiveSessionAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = createAdminClient();

    const cohortId = strField(formData, "cohort_id");
    const title = strField(formData, "title");
    const description = nullableStr(formData, "description");
    const scheduledAtRaw = nullableStr(formData, "scheduled_at");
    const zoomMeetingId = strField(formData, "zoom_meeting_id");
    const zoomPassword = nullableStr(formData, "zoom_password");

    if (!cohortId) return { ok: false, error: "Turma é obrigatória." };
    if (!title) return { ok: false, error: "Título é obrigatório." };
    if (!zoomMeetingId)
      return { ok: false, error: "Meeting ID do Zoom é obrigatório." };

    let scheduledAt: string | null = null;
    if (scheduledAtRaw) {
      const withTz =
        /[Zz]$|[+-]\d{2}:?\d{2}$/.test(scheduledAtRaw)
          ? scheduledAtRaw
          : scheduledAtRaw + "-03:00";
      const d = new Date(withTz);
      if (!Number.isNaN(d.getTime())) scheduledAt = d.toISOString();
    }

    const { error } = await sb
      .schema("membros")
      .from("live_sessions")
      .update({
        cohort_id: cohortId,
        title,
        description,
        scheduled_at: scheduledAt,
        zoom_meeting_id: zoomMeetingId.replace(/\s/g, ""),
        zoom_password: zoomPassword,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/live-sessions");
    revalidatePath("/monitorias", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/**
 * Inicia a monitoria → status='live' + notifica push pra todos os alunos
 * com matrícula ativa na cohort.
 */
export async function startLiveSessionAction(
  id: string,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = createAdminClient();

    const { data: sessionRow } = await sb
      .schema("membros")
      .from("live_sessions")
      .select("id, cohort_id, title, status")
      .eq("id", id)
      .maybeSingle();
    const session = sessionRow as
      | { id: string; cohort_id: string; title: string; status: string }
      | null;
    if (!session) return { ok: false, error: "Monitoria não encontrada." };
    if (session.status === "ended" || session.status === "cancelled") {
      return {
        ok: false,
        error: "Monitoria já encerrada — crie uma nova.",
      };
    }
    if (session.status === "live") {
      return { ok: true }; // idempotente
    }

    const nowIso = new Date().toISOString();
    const { error } = await sb
      .schema("membros")
      .from("live_sessions")
      .update({
        status: "live",
        started_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    // Notifica alunos com matrícula ativa na cohort
    const { data: enrollments } = await sb
      .schema("membros")
      .from("enrollments")
      .select("user_id, expires_at")
      .eq("cohort_id", session.cohort_id)
      .eq("is_active", true);
    const userIds = (
      (enrollments ?? []) as Array<{
        user_id: string;
        expires_at: string | null;
      }>
    )
      .filter(
        (e) =>
          e.expires_at === null || new Date(e.expires_at) > new Date(),
      )
      .map((e) => e.user_id);

    if (userIds.length > 0) {
      await tryNotifyMany(userIds, {
        title: "🔴 Monitoria ao vivo agora",
        body: session.title,
        link: `/monitorias/${id}`,
        pushCategory: "broadcast",
      });
    }

    revalidatePath("/admin/live-sessions");
    revalidatePath("/monitorias", "layout");
    revalidatePath(`/monitorias/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Encerra → status='ended'. Aluno deixa de ver na lista. */
export async function endLiveSessionAction(
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
        status: "ended",
        ended_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/live-sessions");
    revalidatePath("/monitorias", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
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
