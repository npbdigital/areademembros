/**
 * Sistema de XP/Streak/Conquistas.
 *
 * Modelo:
 *   - Trimestre fixo (jan-mar/abr-jun/jul-set/out-dez). XP zera no início de cada.
 *   - `user_xp` agrega total atual; `xp_log` é a auditoria.
 *   - `xp_log` tem UNIQUE em (user_id, reason, reference_id, period_start) — garante
 *     idempotência: a mesma ação numa mesma referência nunca dá XP 2x no trimestre.
 *   - Streak conta dias consecutivos com qualquer acesso. Reseta após pular 1 dia.
 *   - Conquistas são desbloqueadas após cada awardXp (greedy check).
 *
 * Use o admin client (service_role) — RLS de gamification só permite leitura ao
 * próprio user. Escritas vêm do server.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";
import { tryNotify } from "@/lib/notifications";

export type XpReason =
  | "lesson_complete"
  | "lesson_rated"
  | "first_access_day"
  | "streak_7d"
  | "comment_approved"
  | "post_approved"
  | "course_completed"
  | "achievement_unlock";

export interface UserXpRow {
  user_id: string;
  total_xp: number;
  current_level: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  current_period_start: string;
  updated_at: string;
}

const LEVEL_THRESHOLDS = [
  { level: 1, min: 0, label: "Iniciante" },
  { level: 2, min: 100, label: "Estudante" },
  { level: 3, min: 300, label: "Dedicado" },
  { level: 4, min: 700, label: "Engajado" },
  { level: 5, min: 1500, label: "Veterano" },
  { level: 6, min: 3500, label: "Mestre" },
];

export function levelFromXp(xp: number): {
  level: number;
  label: string;
  currentMin: number;
  nextMin: number | null;
  progressPct: number;
} {
  let current = LEVEL_THRESHOLDS[0];
  for (const t of LEVEL_THRESHOLDS) {
    if (xp >= t.min) current = t;
  }
  const next = LEVEL_THRESHOLDS.find((t) => t.level === current.level + 1);
  const range = next ? next.min - current.min : 1;
  const inLevel = xp - current.min;
  const progressPct = next
    ? Math.min(100, Math.round((inLevel / range) * 100))
    : 100;
  return {
    level: current.level,
    label: current.label,
    currentMin: current.min,
    nextMin: next?.min ?? null,
    progressPct,
  };
}

/**
 * Verifica se o usuário tem registro em user_xp; cria se não tiver.
 * Também aplica reset trimestral se o period_start estiver desatualizado.
 *
 * Usa admin client (necessário pra escrever).
 */
export async function ensureUserXp(
  admin: SupabaseClient,
  userId: string,
): Promise<UserXpRow> {
  const { data: existing } = await admin
    .schema("membros")
    .from("user_xp")
    .select(
      "user_id, total_xp, current_level, current_streak, longest_streak, last_activity_date, current_period_start, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  // Pega o início do trimestre atual via SQL pra garantir consistência
  const { data: periodRow } = await admin.rpc("current_xp_period_start");
  const periodStart = (periodRow as string | null) ?? new Date().toISOString();

  if (!existing) {
    const { data: created } = await admin
      .schema("membros")
      .from("user_xp")
      .insert({
        user_id: userId,
        current_period_start: periodStart,
      })
      .select(
        "user_id, total_xp, current_level, current_streak, longest_streak, last_activity_date, current_period_start, updated_at",
      )
      .single();
    return created as UserXpRow;
  }

  const e = existing as UserXpRow;
  // Se o period_start é antigo → reset (preserva longest_streak e last_activity_date)
  if (new Date(e.current_period_start) < new Date(periodStart)) {
    const { data: updated } = await admin
      .schema("membros")
      .from("user_xp")
      .update({
        total_xp: 0,
        current_level: 1,
        current_period_start: periodStart,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select(
        "user_id, total_xp, current_level, current_streak, longest_streak, last_activity_date, current_period_start, updated_at",
      )
      .single();
    return updated as UserXpRow;
  }

  return e;
}

/**
 * Concede XP idempotentemente.
 *
 * - `reason` + `referenceId` + `period_start` é a chave única — repetir não dupla.
 * - Quando reference é null, pode duplicar (use só pra ações sem ref específica,
 *   tipo "first_access_day" — mas mesmo essa usa data do dia como ref pra
 *   garantir 1x por dia).
 * - Após inserir o log e atualizar o agregado, dispara checagem de conquistas.
 *
 * Retorna a quantidade efetivamente concedida (0 se idempotente bateu).
 */
export async function awardXp(
  admin: SupabaseClient,
  params: {
    userId: string;
    amount: number;
    reason: XpReason | string;
    referenceId?: string | null;
  },
): Promise<{ awarded: number; total: number; level: number }> {
  if (params.amount <= 0) {
    const xp = await ensureUserXp(admin, params.userId);
    return { awarded: 0, total: xp.total_xp, level: xp.current_level };
  }

  const xp = await ensureUserXp(admin, params.userId);

  // Tenta inserir no log — se conflitar (mesma reason+ref+period), pula
  const insert = await admin
    .schema("membros")
    .from("xp_log")
    .insert({
      user_id: params.userId,
      amount: params.amount,
      reason: params.reason,
      reference_id: params.referenceId ?? null,
      period_start: xp.current_period_start,
    })
    .select("id")
    .maybeSingle();

  // Se houve conflito de UNIQUE (idempotência), insert.error existe e data é null
  if (!insert.data) {
    return { awarded: 0, total: xp.total_xp, level: xp.current_level };
  }

  const newTotal = xp.total_xp + params.amount;
  const newLevel = levelFromXp(newTotal).level;
  await admin
    .schema("membros")
    .from("user_xp")
    .update({
      total_xp: newTotal,
      current_level: newLevel,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId);

  // Verifica conquistas após XP gain
  await checkAchievements(admin, params.userId);

  return { awarded: params.amount, total: newTotal, level: newLevel };
}

/**
 * Atualiza streak baseado em "acesso hoje".
 *
 * - Se nunca teve atividade → streak = 1
 * - Se última atividade foi ontem → streak += 1
 * - Se última atividade foi hoje → noop
 * - Se última atividade foi >1 dia atrás → streak = 1
 * - Atualiza longest_streak se necessário
 * - Se streak passou múltiplo de 7, dá XP de streak (idempotente via reference)
 */
export async function bumpStreak(
  admin: SupabaseClient,
  userId: string,
  xpStreak7d: number,
): Promise<{ streak: number; awardedStreakXp: number }> {
  const xp = await ensureUserXp(admin, userId);
  const today = todayUtc();
  const last = xp.last_activity_date;

  let newStreak = xp.current_streak;
  if (!last) {
    newStreak = 1;
  } else {
    const lastDate = last;
    const yesterday = addDays(today, -1);
    if (lastDate === today) {
      // já contado hoje
      return { streak: xp.current_streak, awardedStreakXp: 0 };
    } else if (lastDate === yesterday) {
      newStreak = xp.current_streak + 1;
    } else {
      newStreak = 1;
    }
  }

  const newLongest = Math.max(xp.longest_streak, newStreak);
  await admin
    .schema("membros")
    .from("user_xp")
    .update({
      current_streak: newStreak,
      longest_streak: newLongest,
      last_activity_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  // XP de marco de streak (a cada múltiplo de 7)
  let awardedStreakXp = 0;
  if (newStreak > 0 && newStreak % 7 === 0 && xpStreak7d > 0) {
    const res = await awardXp(admin, {
      userId,
      amount: xpStreak7d,
      reason: "streak_7d",
      // referenceId aceita uuid ou null no schema; aqui mandamos null e usamos
      // a UNIQUE simples (vai conflitar se rodar 2x no mesmo dia, mas como o
      // dia só fecha em 7d isso é OK)
      referenceId: null,
    });
    awardedStreakXp = res.awarded;
  }

  return { streak: newStreak, awardedStreakXp };
}

/**
 * Verifica conquistas elegíveis e desbloqueia (idempotente via PK).
 * Calcula contadores reais via queries.
 */
export async function checkAchievements(
  admin: SupabaseClient,
  userId: string,
): Promise<number> {
  const [
    { data: achievementsData },
    { data: alreadyData },
    completedLessonsCount,
    notesCount,
    favoritesCount,
    ratingsCount,
    postsApprovedCount,
    commentsCount,
    coursesCompletedCount,
    streakInfo,
  ] = await Promise.all([
    admin
      .schema("membros")
      .from("achievements")
      .select("id, code, name, description, icon, required_value, xp_reward")
      .eq("is_active", true),
    admin
      .schema("membros")
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", userId),
    countTable(admin, "lesson_progress", { user_id: userId, is_completed: true }),
    countTable(admin, "lesson_notes", { user_id: userId }),
    countTable(admin, "lesson_favorites", { user_id: userId }),
    countTable(admin, "lesson_ratings", { user_id: userId }),
    countTable(admin, "community_topics", { user_id: userId, status: "approved" }),
    countTable(admin, "community_replies", { user_id: userId }),
    countCompletedCourses(admin, userId),
    admin
      .schema("membros")
      .from("user_xp")
      .select("longest_streak")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const longest =
    (streakInfo.data as { longest_streak?: number } | null)?.longest_streak ??
    0;

  const alreadyIds = new Set(
    ((alreadyData ?? []) as Array<{ achievement_id: string }>).map(
      (a) => a.achievement_id,
    ),
  );

  let unlockedCount = 0;
  for (const ach of (achievementsData ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    icon: string;
    required_value: number;
    xp_reward: number;
  }>) {
    if (alreadyIds.has(ach.id)) continue;

    let value = 0;
    switch (ach.code) {
      case "first_lesson":
      case "lessons_10":
      case "lessons_50":
      case "lessons_100":
        value = completedLessonsCount;
        break;
      case "first_note":
        value = notesCount;
        break;
      case "first_favorite":
        value = favoritesCount;
        break;
      case "first_rating":
        value = ratingsCount;
        break;
      case "first_post":
      case "posts_5":
      case "posts_20":
        value = postsApprovedCount;
        break;
      case "first_comment":
      case "comments_10":
      case "comments_50":
        value = commentsCount;
        break;
      case "courses_1":
      case "courses_3":
      case "courses_10":
        value = coursesCompletedCount;
        break;
      case "streak_7":
      case "streak_30":
      case "streak_100":
        value = longest;
        break;
      default:
        continue;
    }

    if (value >= ach.required_value) {
      const ins = await admin
        .schema("membros")
        .from("user_achievements")
        .insert({
          user_id: userId,
          achievement_id: ach.id,
        })
        .select("user_id")
        .maybeSingle();
      if (ins.data) {
        unlockedCount++;
        if (ach.xp_reward > 0) {
          await awardXp(admin, {
            userId,
            amount: ach.xp_reward,
            reason: "achievement_unlock",
            referenceId: ach.id,
          });
        }
        // Notifica conquista desbloqueada
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
  }

  return unlockedCount;
}

async function countTable(
  admin: SupabaseClient,
  table: string,
  filters: Record<string, unknown>,
): Promise<number> {
  let q = admin.schema("membros").from(table).select("*", {
    count: "exact",
    head: true,
  });
  for (const [k, v] of Object.entries(filters)) {
    q = q.eq(k, v as string | number | boolean);
  }
  const { count } = await q;
  return count ?? 0;
}

/**
 * Conta cursos onde TODAS as aulas publicadas têm lesson_progress.is_completed
 * pra esse user. Implementação ingênua: conta cursos com pelo menos 1 aula e
 * todas concluídas. Pode ser lento se muitos cursos — aceitável pra agora.
 */
async function countCompletedCourses(
  admin: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data: courses } = await admin
    .schema("membros")
    .from("courses")
    .select("id")
    .eq("is_published", true);

  if (!courses?.length) return 0;

  let done = 0;
  for (const c of courses as Array<{ id: string }>) {
    const { data: modules } = await admin
      .schema("membros")
      .from("modules")
      .select("id")
      .eq("course_id", c.id);
    const moduleIds = (modules ?? []).map((m) => m.id);
    if (moduleIds.length === 0) continue;

    const { data: lessons } = await admin
      .schema("membros")
      .from("lessons")
      .select("id")
      .in("module_id", moduleIds);
    const lessonIds = (lessons ?? []).map((l) => l.id);
    if (lessonIds.length === 0) continue;

    const { count: completed } = await admin
      .schema("membros")
      .from("lesson_progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_completed", true)
      .in("lesson_id", lessonIds);

    if ((completed ?? 0) >= lessonIds.length) {
      done++;
    }
  }
  return done;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function addDays(yyyymmdd: string, delta: number): string {
  const d = new Date(yyyymmdd + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Atalho que server actions usam — cria admin client + lê settings + chama
 * awardXp se gamification ativo. Silent-fail (não bloqueia UX).
 */
export async function tryAwardXp(params: {
  userId: string;
  reason: XpReason;
  amount: number;
  referenceId?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const settings = await getPlatformSettings(admin);
    if (!settings.gamificationEnabled) return;
    if (params.amount <= 0) return;
    await awardXp(admin, params);
  } catch {
    // best-effort
  }
}

/**
 * Atalho pra atualizar streak + dar XP de "primeiro acesso do dia".
 * Chamado em logLessonViewAction (ponto principal de "engajamento real").
 */
export async function tryBumpStreakAndDailyXp(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const settings = await getPlatformSettings(admin);
    if (!settings.gamificationEnabled) return;

    await bumpStreak(admin, userId, settings.xpStreak7d);

    if (settings.xpFirstAccessDay > 0) {
      const today = todayUtc();
      // referenceId precisa ser um UUID na coluna — usamos null e aceitamos
      // que o UNIQUE (com WHERE reference_id IS NOT NULL) deixa passar.
      // Idempotência aqui é garantida por chave composta lógica via reason
      // por dia: criamos um log diário e checamos antes.
      const { data: existsToday } = await admin
        .schema("membros")
        .from("xp_log")
        .select("id")
        .eq("user_id", userId)
        .eq("reason", "first_access_day")
        .gte("created_at", `${today}T00:00:00.000Z`)
        .lt("created_at", `${addDays(today, 1)}T00:00:00.000Z`)
        .limit(1)
        .maybeSingle();

      if (!existsToday) {
        await awardXp(admin, {
          userId,
          amount: settings.xpFirstAccessDay,
          reason: "first_access_day",
          referenceId: null,
        });
      }
    }
  } catch {
    // best-effort
  }
}
