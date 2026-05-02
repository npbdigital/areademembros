/**
 * Helpers de formatação de datas em BRT (America/Sao_Paulo).
 *
 * Por que: o banco grava tudo em UTC. Renderização SSR rodando no Vercel
 * (também UTC) exibiria "17:07" pra um evento que aconteceu às "14:07 BRT" —
 * confunde o admin (Felipe/Brasil). Esses helpers garantem o fuso brasileiro
 * independente de onde o código roda.
 */

const TZ = "America/Sao_Paulo";

/** Ex: "02/05/2026" */
export function formatDateBrt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: TZ });
}

/** Ex: "02/05/2026 14:07" */
export function formatDateTimeBrt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Ex: "02 mai" */
export function formatShortBrt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
  });
}
