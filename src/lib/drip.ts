/**
 * Lógica de drip content — calcula se um módulo/aula está liberado para o aluno.
 *
 * Tipos de release_type (vindos de membros.modules e membros.lessons):
 * - "immediate"            → liberado assim que o aluno se matricula
 * - "locked"               → bloqueado pelo admin (nunca libera sozinho)
 * - "days_after_enrollment" → libera N dias após enrolled_at
 * - "fixed_date"           → libera em release_date (ISO)
 *
 * Quando o aluno tem múltiplas matrículas que dão acesso ao mesmo curso,
 * use a `enrolled_at` mais antiga (libera mais cedo) — essa decisão é do caller.
 */

export type ReleaseType =
  | "immediate"
  | "locked"
  | "days_after_enrollment"
  | "fixed_date";

export interface DripConfig {
  release_type?: string | null;
  release_days?: number | null;
  release_date?: string | null;
}

export interface ReleaseStatus {
  released: boolean;
  /** Quando libera. null se já liberado, ou se está locked indefinidamente. */
  releaseAt: Date | null;
  /** "locked" quando bloqueado pelo admin (sem data de liberação prevista). */
  reason?: "locked" | "scheduled";
}

/**
 * Decide se um conteúdo está liberado para um aluno.
 *
 * @param drip - configuração de release do módulo/aula
 * @param enrolledAt - data ISO da matrícula do aluno na turma que dá acesso
 *                    (irrelevante para "immediate"/"locked"/"fixed_date")
 * @param now - data de referência (default: agora) — útil para testes
 */
export function isContentReleased(
  drip: DripConfig,
  enrolledAt: string | Date | null | undefined,
  now: Date = new Date(),
): ReleaseStatus {
  const type = (drip.release_type as ReleaseType) || "immediate";

  if (type === "immediate") {
    return { released: true, releaseAt: null };
  }

  if (type === "locked") {
    return { released: false, releaseAt: null, reason: "locked" };
  }

  if (type === "fixed_date") {
    if (!drip.release_date) {
      return { released: true, releaseAt: null };
    }
    const releaseAt = new Date(drip.release_date);
    return {
      released: now >= releaseAt,
      releaseAt,
      reason: now >= releaseAt ? undefined : "scheduled",
    };
  }

  if (type === "days_after_enrollment") {
    const days = drip.release_days ?? 0;
    if (days < 1 || !enrolledAt) {
      return { released: true, releaseAt: null };
    }
    const base = enrolledAt instanceof Date ? enrolledAt : new Date(enrolledAt);
    const releaseAt = new Date(base);
    releaseAt.setDate(releaseAt.getDate() + days);
    return {
      released: now >= releaseAt,
      releaseAt,
      reason: now >= releaseAt ? undefined : "scheduled",
    };
  }

  return { released: true, releaseAt: null };
}

/** Formata a data de liberação no padrão pt-BR. */
export function formatReleaseDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Mensagem amigável de bloqueio para exibir na UI. */
export function releaseMessage(status: ReleaseStatus): string {
  if (status.released) return "";
  if (status.reason === "locked") return "Bloqueado pelo administrador";
  if (status.releaseAt)
    return `Disponível em ${formatReleaseDate(status.releaseAt)}`;
  return "Bloqueado";
}
