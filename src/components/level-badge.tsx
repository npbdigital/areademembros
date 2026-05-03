/**
 * Badge mini do nível do aluno (estilo Twitter verificado, mas escalado
 * pra 5 tiers visuais distintos: I/II/III/IV/V com cores diferentes).
 *
 * Renderiza ao lado do nome do autor em PostCard, comentários, leaderboard,
 * etc. Server-friendly (img tag pura).
 *
 * Convenção de cores (mesma dos `LEVEL_THRESHOLDS` em lib/gamification.ts):
 *  - I   → Recruta (cinza)
 *  - II  → Estrategista (verde)
 *  - III → Especialista (azul)
 *  - IV  → Autoridade (roxo)
 *  - V   → Elite (dourado)
 */

const LEVEL_LABELS: Record<number, string> = {
  1: "Nível I — Recruta",
  2: "Nível II — Estrategista",
  3: "Nível III — Especialista",
  4: "Nível IV — Autoridade",
  5: "Nível V — Elite",
};

interface Props {
  /** 1-5. Valores fora do range são clampados. Null/undefined = não renderiza. */
  level?: number | null;
  /** Tamanho em pixels (quadrado). Default 16 (lado do nome). */
  size?: number;
  className?: string;
}

export function LevelBadge({ level, size = 16, className }: Props) {
  if (level == null) return null;
  const clamped = Math.max(1, Math.min(5, Math.floor(level)));
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/imagens/levels/badge-mini-${clamped}.svg`}
      alt={LEVEL_LABELS[clamped]}
      title={LEVEL_LABELS[clamped]}
      width={size}
      height={size}
      className={`inline-block flex-shrink-0 align-middle ${className ?? ""}`}
      style={{ width: size, height: size }}
    />
  );
}
