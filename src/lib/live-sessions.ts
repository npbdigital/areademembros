/**
 * Helpers compartilhados das monitorias ao vivo (Zoom).
 *
 * Status agora é DERIVADO de `scheduled_at + duration_minutes` contra
 * o relógio atual — admin não precisa mais clicar "Iniciar"/"Encerrar".
 * O campo `status` no DB só serve pra override manual (`cancelled`).
 */

export type ComputedStatus = "scheduled" | "live" | "ended" | "cancelled";

export interface LiveSessionTimeInput {
  scheduled_at: string | null;
  duration_minutes: number | null;
  status: string | null;
}

/**
 * Calcula o status real da monitoria a partir do horário programado +
 * duração + status manual. `cancelled` no DB é um override absoluto.
 *
 * Buffer de 5min antes do início pra contar como "ao vivo" — ajuda
 * alunos que entram um pouco cedo já verem o botão habilitado.
 */
export function computeLiveStatus(
  s: LiveSessionTimeInput,
  now: Date = new Date(),
): ComputedStatus {
  if (s.status === "cancelled") return "cancelled";
  if (!s.scheduled_at) return "scheduled";

  const scheduled = new Date(s.scheduled_at);
  if (Number.isNaN(scheduled.getTime())) return "scheduled";

  const duration = Math.max(15, s.duration_minutes ?? 90);
  const startWithBuffer = new Date(scheduled.getTime() - 5 * 60_000);
  const endsAt = new Date(scheduled.getTime() + duration * 60_000);

  if (now < startWithBuffer) return "scheduled";
  if (now < endsAt) return "live";
  return "ended";
}

/**
 * Constrói a URL universal do Zoom — `zoom.us/j/...` faz o navegador/SO
 * tentar abrir o app desktop ou mobile via custom protocol; cai no
 * webclient como fallback.
 */
export function buildZoomJoinUrl(
  meetingId: string,
  password?: string | null,
): string {
  const cleanId = meetingId.replace(/\D/g, "");
  const base = `https://zoom.us/j/${encodeURIComponent(cleanId)}`;
  if (!password) return base;
  return `${base}?pwd=${encodeURIComponent(password)}`;
}
