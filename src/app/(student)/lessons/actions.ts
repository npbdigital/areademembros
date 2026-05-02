"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";
import {
  tryAwardXp,
  tryBumpStreakAndDailyXp,
} from "@/lib/gamification";

export type ActionResult = { ok: boolean; error?: string };

async function requireUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");
  return user.id;
}

export async function toggleCompleteAction(
  lessonId: string,
  shouldComplete: boolean,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const supabase = createClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .schema("membros")
      .from("lesson_progress")
      .upsert(
        {
          user_id: userId,
          lesson_id: lessonId,
          is_completed: shouldComplete,
          completed_at: shouldComplete ? now : null,
          last_watched_at: now,
        },
        { onConflict: "user_id,lesson_id" },
      );

    if (error) return { ok: false, error: error.message };

    if (shouldComplete) {
      await supabase.schema("membros").from("access_logs").insert({
        user_id: userId,
        lesson_id: lessonId,
        action: "lesson_complete",
      });

      // XP por concluir aula (idempotente por lessonId — só rende 1x na vida)
      const adminSb = createAdminClient();
      const settings = await getPlatformSettings(adminSb);
      if (settings.gamificationEnabled && settings.xpLessonComplete > 0) {
        await tryAwardXp({
          userId,
          reason: "lesson_complete",
          amount: settings.xpLessonComplete,
          referenceId: lessonId,
        });

        // Verifica se concluiu o curso → XP extra
        await checkCourseCompletion(adminSb, userId, lessonId, settings.xpCourseCompleted);
      }
    }

    revalidatePath(`/lessons/${lessonId}`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

export async function toggleFavoriteAction(
  lessonId: string,
  shouldFavorite: boolean,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const supabase = createClient();

    if (shouldFavorite) {
      const { error } = await supabase
        .schema("membros")
        .from("lesson_favorites")
        .upsert(
          { user_id: userId, lesson_id: lessonId },
          { onConflict: "user_id,lesson_id" },
        );
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase
        .schema("membros")
        .from("lesson_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("lesson_id", lessonId);
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath(`/lessons/${lessonId}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

export async function saveNoteAction(
  lessonId: string,
  content: string,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const supabase = createClient();
    const trimmed = content.trim();

    const { data: existing } = await supabase
      .schema("membros")
      .from("lesson_notes")
      .select("id")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (existing) {
      if (trimmed.length === 0) {
        const { error } = await supabase
          .schema("membros")
          .from("lesson_notes")
          .delete()
          .eq("id", existing.id);
        if (error) return { ok: false, error: error.message };
      } else {
        const { error } = await supabase
          .schema("membros")
          .from("lesson_notes")
          .update({ content: trimmed, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) return { ok: false, error: error.message };
      }
    } else if (trimmed.length > 0) {
      const { error } = await supabase
        .schema("membros")
        .from("lesson_notes")
        .insert({ user_id: userId, lesson_id: lessonId, content: trimmed });
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath(`/lessons/${lessonId}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

export async function rateLessonAction(
  lessonId: string,
  rating: number,
  comment: string,
): Promise<ActionResult> {
  try {
    if (rating < 1 || rating > 5) {
      return { ok: false, error: "Avaliação deve ser entre 1 e 5." };
    }
    const userId = await requireUserId();
    const supabase = createClient();

    const { error } = await supabase
      .schema("membros")
      .from("lesson_ratings")
      .upsert(
        {
          user_id: userId,
          lesson_id: lessonId,
          rating,
          comment: comment.trim() || null,
        },
        { onConflict: "user_id,lesson_id" },
      );

    if (error) return { ok: false, error: error.message };

    // XP por avaliar (1x por aula — só rende uma vez)
    const adminSb = createAdminClient();
    const settings = await getPlatformSettings(adminSb);
    if (settings.gamificationEnabled) {
      await tryAwardXp({
        userId,
        reason: "lesson_rated",
        amount: settings.xpLessonRated,
        referenceId: lessonId,
      });
    }

    revalidatePath(`/lessons/${lessonId}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

export async function pingWatchTimeAction(
  lessonId: string,
  deltaSeconds: number,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const supabase = createClient();
    const safeDelta = Math.max(0, Math.min(120, Math.floor(deltaSeconds)));
    if (safeDelta === 0) return { ok: true };

    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .schema("membros")
      .from("lesson_progress")
      .select("id, watch_time_seconds")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (existing) {
      const next = (existing.watch_time_seconds ?? 0) + safeDelta;
      await supabase
        .schema("membros")
        .from("lesson_progress")
        .update({ watch_time_seconds: next, last_watched_at: now })
        .eq("id", existing.id);
    } else {
      await supabase.schema("membros").from("lesson_progress").insert({
        user_id: userId,
        lesson_id: lessonId,
        watch_time_seconds: safeDelta,
        last_watched_at: now,
      });
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

export async function saveLessonPositionAction(
  lessonId: string,
  positionSeconds: number,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const supabase = createClient();
    const safe = Math.max(0, Math.floor(positionSeconds));

    const { data: existing } = await supabase
      .schema("membros")
      .from("lesson_progress")
      .select("id")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (existing) {
      await supabase
        .schema("membros")
        .from("lesson_progress")
        .update({ last_position_seconds: safe })
        .eq("id", existing.id);
    } else {
      await supabase.schema("membros").from("lesson_progress").insert({
        user_id: userId,
        lesson_id: lessonId,
        last_position_seconds: safe,
      });
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}

/**
 * Verifica se o aluno acabou de completar 100% de algum curso ao concluir
 * essa aula. Se sim, dá XP bonus (idempotente por courseId).
 */
async function checkCourseCompletion(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  lessonId: string,
  xpAmount: number,
): Promise<void> {
  if (xpAmount <= 0) return;
  // Descobre o curso da aula
  const { data: lesson } = await admin
    .schema("membros")
    .from("lessons")
    .select("module_id, modules(course_id)")
    .eq("id", lessonId)
    .maybeSingle();
  const mod = (lesson as { modules?: { course_id: string } | { course_id: string }[] | null } | null)?.modules;
  const courseId = (Array.isArray(mod) ? mod[0]?.course_id : mod?.course_id) ?? null;
  if (!courseId) return;

  // Pega todas as aulas do curso
  const { data: modules } = await admin
    .schema("membros")
    .from("modules")
    .select("id")
    .eq("course_id", courseId);
  const moduleIds = ((modules ?? []) as Array<{ id: string }>).map((m) => m.id);
  if (moduleIds.length === 0) return;

  const { data: allLessons } = await admin
    .schema("membros")
    .from("lessons")
    .select("id")
    .in("module_id", moduleIds);
  const lessonIds = ((allLessons ?? []) as Array<{ id: string }>).map((l) => l.id);
  if (lessonIds.length === 0) return;

  const { count: completed } = await admin
    .schema("membros")
    .from("lesson_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_completed", true)
    .in("lesson_id", lessonIds);

  if ((completed ?? 0) >= lessonIds.length) {
    await tryAwardXp({
      userId,
      reason: "course_completed",
      amount: xpAmount,
      referenceId: courseId,
    });
  }
}

export async function logLessonViewAction(
  lessonId: string,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const supabase = createClient();
    const now = new Date().toISOString();

    await supabase.schema("membros").from("access_logs").insert({
      user_id: userId,
      lesson_id: lessonId,
      action: "lesson_view",
    });

    await supabase
      .schema("membros")
      .from("lesson_progress")
      .upsert(
        {
          user_id: userId,
          lesson_id: lessonId,
          last_watched_at: now,
        },
        { onConflict: "user_id,lesson_id", ignoreDuplicates: false },
      );

    // Atualiza streak + XP de "primeiro acesso do dia"
    await tryBumpStreakAndDailyXp(userId);

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return { ok: false, error: msg };
  }
}
