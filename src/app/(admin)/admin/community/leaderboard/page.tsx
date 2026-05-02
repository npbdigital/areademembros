import Link from "next/link";
import { ArrowLeft, Crown, Flame, Trophy } from "lucide-react";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { canSeeLeaderboard, getPlatformSettings } from "@/lib/settings";
import { getUserRole } from "@/lib/access";
import { levelFromXp } from "@/lib/gamification";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await getUserRole(supabase, user.id);
  const adminSb = createAdminClient();
  const settings = await getPlatformSettings(adminSb);

  if (!canSeeLeaderboard(settings, role)) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-8 text-center">
          <Trophy className="mx-auto h-10 w-10 text-npb-text-muted" />
          <h1 className="mt-4 text-xl font-bold text-npb-text">
            Leaderboard indisponível
          </h1>
          <p className="mt-2 text-sm text-npb-text-muted">
            Seu perfil não tem permissão pra ver o ranking. Admin pode ajustar
            isso em Configurações → Gamification.
          </p>
        </div>
      </div>
    );
  }

  if (!settings.gamificationEnabled) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-8 text-center text-sm text-npb-text-muted">
          Gamification está desligado em Configurações.
        </div>
      </div>
    );
  }

  // Top 30 do trimestre atual (admin client pra ler tudo)
  const { data: top } = await adminSb
    .schema("membros")
    .from("user_xp")
    .select("user_id, total_xp, current_streak, longest_streak, current_level")
    .order("total_xp", { ascending: false })
    .limit(30);

  const rows = (top ?? []) as Array<{
    user_id: string;
    total_xp: number;
    current_streak: number;
    longest_streak: number;
    current_level: number;
  }>;

  const userIds = rows.map((r) => r.user_id);
  const profiles = new Map<
    string,
    { full_name: string | null; avatar_url: string | null; role: string }
  >();
  if (userIds.length > 0) {
    const { data: us } = await adminSb
      .schema("membros")
      .from("users")
      .select("id, full_name, avatar_url, role")
      .in("id", userIds);
    for (const u of (us ?? []) as Array<{
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      role: string;
    }>) {
      profiles.set(u.id, u);
    }
  }

  // Filtra admin/moderator do ranking (justo)
  const studentsOnly = rows.filter(
    (r) => profiles.get(r.user_id)?.role === "student",
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/community"
          className="inline-flex items-center gap-1 text-sm text-npb-text-muted hover:text-npb-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>
        <h1 className="mt-3 inline-flex items-center gap-2 text-xl font-bold text-npb-text">
          <Crown className="h-5 w-5 text-npb-gold" />
          Leaderboard do trimestre
        </h1>
        <p className="text-sm text-npb-text-muted">
          Top 30 alunos por XP no trimestre atual. Admin/moderador não entram no
          ranking.
        </p>
      </div>

      {studentsOnly.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-8 text-center text-sm text-npb-text-muted">
          Ainda não há atividade pontuada neste trimestre.
        </div>
      ) : (
        <ol className="space-y-2">
          {studentsOnly.map((r, i) => {
            const p = profiles.get(r.user_id);
            const lvl = levelFromXp(r.total_xp);
            const rank = i + 1;
            const isPodium = rank <= 3;
            return (
              <li
                key={r.user_id}
                className={`flex items-center gap-4 rounded-xl border p-4 ${
                  isPodium
                    ? "border-npb-gold/40 bg-npb-gold/5"
                    : "border-npb-border bg-npb-bg2"
                }`}
              >
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    rank === 1
                      ? "bg-yellow-500/20 text-yellow-400"
                      : rank === 2
                        ? "bg-zinc-400/20 text-zinc-300"
                        : rank === 3
                          ? "bg-orange-700/20 text-orange-400"
                          : "bg-npb-bg3 text-npb-text-muted"
                  }`}
                >
                  {rank}
                </div>
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-npb-bg3">
                  {p?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-bold text-npb-gold">
                      {(p?.full_name || "?")[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-npb-text">
                    {p?.full_name || "Aluno"}
                  </p>
                  <p className="text-xs text-npb-text-muted">
                    Nível {lvl.level} · {lvl.label}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1 text-orange-400">
                    <Flame className="h-3 w-3" />
                    {r.current_streak}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-npb-gold">
                    <Trophy className="h-3 w-3" />
                    {r.total_xp} XP
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
