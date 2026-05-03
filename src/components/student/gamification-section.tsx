import { Flame, Trophy } from "lucide-react";

export interface AchievementView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string;
  category: string;
  requiredValue: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

interface Props {
  totalXp: number;
  level: number;
  levelLabel: string;
  levelIconUrl?: string;
  progressPct: number;
  nextMin: number | null;
  currentStreak: number;
  longestStreak: number;
  achievements: AchievementView[];
}

export function GamificationSection({
  totalXp,
  level,
  levelLabel,
  levelIconUrl,
  progressPct,
  nextMin,
  currentStreak,
  longestStreak,
  achievements,
}: Props) {
  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  return (
    <section id="gamification" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-lg font-bold text-npb-text">
          <Trophy className="h-5 w-5 text-npb-gold" />
          Sua jornada
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-npb-text-muted">
          XP cumulativo · não zera
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-npb-text-muted">
            Nível atual
          </p>
          <div className="mt-2 flex items-center gap-3">
            {levelIconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={levelIconUrl}
                alt={`Nível ${level} — ${levelLabel}`}
                className="h-20 w-20 flex-shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-npb-gold leading-tight">
                {levelLabel}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-npb-text-muted">
                Nível {level}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-npb-bg4">
                <div
                  className="h-full bg-npb-gold-gradient"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-npb-text-muted">
                {totalXp} XP
                {nextMin
                  ? ` · faltam ${Math.max(nextMin - totalXp, 0)} pro próximo`
                  : " · nível máximo"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-400">
            Streak atual
          </p>
          <p className="mt-1 inline-flex items-baseline gap-1.5 text-2xl font-bold text-npb-text">
            <Flame className="h-5 w-5 self-center text-orange-400" />
            {currentStreak}
            <span className="text-sm font-normal text-npb-text-muted">
              {currentStreak === 1 ? "dia" : "dias"}
            </span>
          </p>
          <p className="mt-1 text-[10px] text-npb-text-muted">
            Acesse algo todo dia pra manter a chama acesa
          </p>
        </div>

        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-npb-text-muted">
            Melhor sequência
          </p>
          <p className="mt-1 text-2xl font-bold text-npb-text">
            {longestStreak}{" "}
            <span className="text-sm font-normal text-npb-text-muted">
              {longestStreak === 1 ? "dia" : "dias"}
            </span>
          </p>
          <p className="mt-1 text-[10px] text-npb-text-muted">
            Recorde histórico de dias seguidos
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-5">
        <h3 className="mb-3 text-sm font-bold text-npb-text">
          Conquistas{" "}
          <span className="text-xs font-normal text-npb-text-muted">
            {unlocked.length}/{achievements.length}
          </span>
        </h3>

        {achievements.length === 0 ? (
          <p className="py-4 text-center text-sm text-npb-text-muted">
            Catálogo de conquistas vazio.
          </p>
        ) : (
          <>
            {unlocked.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-npb-gold">
                  Desbloqueadas
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {unlocked.map((a) => (
                    <AchievementBadge key={a.id} a={a} />
                  ))}
                </div>
              </div>
            )}
            {locked.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-npb-text-muted">
                  Pra desbloquear
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {locked.map((a) => (
                    <AchievementBadge key={a.id} a={a} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function AchievementBadge({ a }: { a: AchievementView }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border p-3 ${
        a.unlocked
          ? "border-npb-gold/40 bg-npb-gold/5"
          : "border-npb-border bg-npb-bg3 opacity-60"
      }`}
      title={a.description ?? ""}
    >
      <span className="text-2xl leading-none">
        {a.unlocked ? a.icon : "🔒"}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-npb-text">{a.name}</p>
        {a.description && (
          <p className="mt-0.5 line-clamp-2 text-[10px] text-npb-text-muted">
            {a.description}
          </p>
        )}
        {a.unlocked && a.unlockedAt && (
          <p className="mt-0.5 text-[9px] text-npb-gold">
            {formatPtDate(a.unlockedAt)}
          </p>
        )}
      </div>
    </div>
  );
}

function formatPtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
