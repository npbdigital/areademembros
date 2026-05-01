/**
 * Helpers puros (não server actions) sobre matrículas.
 */

/**
 * Calcula a data de expiração de uma matrícula a partir da duração da turma.
 * Retorna null pra duração nula (vitalício).
 *
 * @param durationDays - dias de duração (NULL = vitalício)
 * @param enrolledAt - data base (default: agora)
 */
export function expiresAtFromDuration(
  durationDays: number | null | undefined,
  enrolledAt?: Date,
): string | null {
  if (!durationDays || durationDays < 1) return null;
  const base = enrolledAt ?? new Date();
  const date = new Date(base);
  date.setDate(date.getDate() + durationDays);
  return date.toISOString();
}
