import Link from "next/link";
import { Flame, Trophy } from "lucide-react";

interface Props {
  totalXp: number;
  level: number;
  levelLabel: string;
  progressPct: number;
  currentStreak: number;
}

/**
 * Pill compacto pro topbar: nível + barra de XP + streak.
 * Server component (não tem state).
 */
export function XpPill({
  totalXp,
  level,
  levelLabel,
  progressPct,
  currentStreak,
}: Props) {
  return (
    <Link
      href="/profile#gamification"
      className="hidden sm:flex items-center gap-3 rounded-lg border border-npb-border bg-npb-bg3 px-3 py-1.5 transition hover:border-npb-gold-dim"
      title={`Nível ${level} — ${levelLabel} · ${totalXp} XP`}
    >
      <div className="flex items-center gap-1.5 text-xs">
        <Trophy className="h-3.5 w-3.5 text-npb-gold" />
        <span className="font-semibold text-npb-text">N{level}</span>
        <span className="hidden text-npb-text-muted md:inline">
          {levelLabel}
        </span>
      </div>
      <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-npb-bg4 md:block">
        <div
          className="h-full bg-npb-gold-gradient"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <span className="hidden text-[10px] text-npb-text-muted md:inline">
        {totalXp} XP
      </span>
      {currentStreak > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold text-orange-400">
          <Flame className="h-3 w-3" />
          {currentStreak}
        </span>
      )}
    </Link>
  );
}
