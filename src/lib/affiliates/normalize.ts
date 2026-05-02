/**
 * Normalização de nome pra dupla verificação Kiwify.
 *
 * Aplica:
 * - lowercase
 * - remove diacríticos (acentos)
 * - trim
 * - colapsa espaços múltiplos em 1
 *
 * Assim "João da Silva", "joao da silva", "JOÃO  DA  SILVA" todos viram
 * "joao da silva" — matching tolerante a variações comuns sem ser
 * permissivo demais.
 */
export function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  // Combining diacritical marks: U+0300–U+036F. Notação \u funciona em ES5+.
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeEmail(s: string | null | undefined): string {
  if (!s) return "";
  return s.trim().toLowerCase();
}
