/**
 * Formata duração em dias pra texto humano amigável.
 * NULL/undefined = vitalício.
 */
export function formatDuration(days: number | null | undefined): string {
  if (days == null) return "Vitalício";
  if (days === 1) return "1 dia";
  if (days < 30) return `${days} dias`;
  if (days === 30) return "1 mês";
  if (days < 365 && days % 30 === 0) {
    const months = days / 30;
    return `${months} meses`;
  }
  if (days === 365) return "1 ano";
  if (days % 365 === 0) {
    const years = days / 365;
    return `${years} anos`;
  }
  return `${days} dias`;
}
