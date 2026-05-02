import Link from "next/link";
import { Flame } from "lucide-react";

interface Props {
  totalXp: number;
  level: number;
  levelLabel: string;
  levelIconUrl?: string;
  progressPct: number;
  currentStreak: number;
}

/**
 * Pill compacto pro topbar: badge do nível + label + barra de XP + streak.
 */
export function XpPill({
  totalXp,
  level,
  levelLabel,
  levelIconUrl,
  progressPct,
  currentStreak,
}: Props) {
  return (
    <Link
      href="/profile#gamification"
      className="hidden sm:flex items-center gap-2.5 rounded-lg border border-npb-border bg-npb-bg3 px-2.5 py-1 transition hover:border-npb-gold-dim"
      title={`Nível ${level} — ${levelLabel} · ${totalXp} XP`}
    >
      {levelIconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={levelIconUrl}
          alt=""
          className="h-7 w-7 flex-shrink-0"
        />
      ) : (
        <span className="text-xs font-semibold text-npb-gold">N{level}</span>
      )}
      <div className="flex flex-col gap-0.5">
        <span className="hidden text-xs font-semibold text-npb-text leading-none md:inline">
          {levelLabel}
        </span>
        <div className="hidden h-1 w-16 overflow-hidden rounded-full bg-npb-bg4 md:block">
          <div
            className="h-full bg-npb-gold-gradient"
            style={{ width: `${progressPct}%` }}
          />
        </div>
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
