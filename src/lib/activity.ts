/**
 * Activity status do aluno — derivado de `auth.users.last_sign_in_at`.
 *
 * Não há coluna `activity_status` no schema. Status é calculado on-the-fly
 * comparando `last_sign_in_at` com `now() - threshold_days`. Vantagens:
 *   - Aluno que loga reativa instantâneo (sem trigger)
 *   - Sem custo de propagação / migration de backfill
 *   - Threshold mudável em runtime via setting (sem rebuild)
 *
 * Critério: aluno é INATIVO quando nunca logou OU `last_sign_in_at` está
 * mais distante que threshold dias atrás.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityStatus = "active" | "inactive";

export function isInactive(
  lastSignInAt: string | null | undefined,
  thresholdDays: number,
): boolean {
  if (!lastSignInAt) return true; // nunca logou = inativo (não engajado)
  const last = new Date(lastSignInAt).getTime();
  if (Number.isNaN(last)) return true;
  const cutoff = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;
  return last < cutoff;
}

export function getActivityStatus(
  lastSignInAt: string | null | undefined,
  thresholdDays: number,
): ActivityStatus {
  return isInactive(lastSignInAt, thresholdDays) ? "inactive" : "active";
}

/** ISO cutoff = now() - thresholdDays. Útil pra usar em queries Supabase. */
export function inactivityCutoffIso(thresholdDays: number): string {
  return new Date(
    Date.now() - thresholdDays * 24 * 60 * 60 * 1000,
  ).toISOString();
}

/**
 * Lista user_ids que estão INATIVOS conforme threshold. Usado pelo
 * resolveBroadcastAudience pra filtrar quem recebe broadcast.
 *
 * Performance: faz uma query na view students_admin (que já tem
 * last_sign_in_at exposto). OK pra MVP — quando volume crescer, dá pra
 * mover esse cálculo pra função SQL.
 */
export async function getUserIdsByActivity(
  supabase: SupabaseClient,
  status: "active" | "inactive",
  thresholdDays: number,
): Promise<string[]> {
  const cutoff = inactivityCutoffIso(thresholdDays);

  if (status === "inactive") {
    // Inativos = nunca logou OU last_sign_in_at < cutoff
    const { data } = await supabase
      .schema("membros")
      .from("students_admin")
      .select("id, last_sign_in_at")
      .or(`last_sign_in_at.is.null,last_sign_in_at.lt.${cutoff}`);
    return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  }

  // Ativos = last_sign_in_at >= cutoff (i.e., logou recentemente)
  const { data } = await supabase
    .schema("membros")
    .from("students_admin")
    .select("id")
    .gte("last_sign_in_at", cutoff);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}
