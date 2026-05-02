import { Calendar, KeyRound, Layers, User as UserIcon } from "lucide-react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/settings";
import { ensureUserXp, levelFromXp } from "@/lib/gamification";
import { ProfileForm } from "@/components/student/profile-form";
import { ChangePasswordForm } from "@/components/student/change-password-form";
import {
  type AchievementView,
  GamificationSection,
} from "@/components/student/gamification-section";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select(
      "full_name, email, phone, avatar_url, created_at, email_notifications_enabled",
    )
    .eq("id", user.id)
    .single();

  const { data: enrollmentsRaw } = await supabase
    .schema("membros")
    .from("enrollments")
    .select(
      "id, enrolled_at, expires_at, is_active, source, cohorts(name, support_prefix)",
    )
    .eq("user_id", user.id)
    .order("enrolled_at", { ascending: false });

  const enrollments = (enrollmentsRaw ?? []) as unknown as Array<{
    id: string;
    enrolled_at: string;
    expires_at: string | null;
    is_active: boolean;
    source: string;
    cohorts:
      | { name: string; support_prefix: string | null }
      | { name: string; support_prefix: string | null }[]
      | null;
  }>;

  // GAMIFICATION
  const adminSb = createAdminClient();
  const settings = await getPlatformSettings(adminSb);
  let gamification: {
    totalXp: number;
    level: number;
    levelLabel: string;
    levelIconUrl: string;
    progressPct: number;
    nextMin: number | null;
    currentStreak: number;
    longestStreak: number;
    periodEnd: string;
    achievements: AchievementView[];
  } | null = null;

  if (settings.gamificationEnabled) {
    try {
      const xp = await ensureUserXp(adminSb, user.id);
      const lvl = levelFromXp(xp.total_xp);
      const periodStart = new Date(xp.current_period_start);
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 3);

      const [{ data: catalogData }, { data: unlockedData }] =
        await Promise.all([
          adminSb
            .schema("membros")
            .from("achievements")
            .select(
              "id, code, name, description, icon, category, required_value, sort_order",
            )
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
          adminSb
            .schema("membros")
            .from("user_achievements")
            .select("achievement_id, unlocked_at")
            .eq("user_id", user.id),
        ]);

      const unlockedMap = new Map(
        ((unlockedData ?? []) as Array<{
          achievement_id: string;
          unlocked_at: string;
        }>).map((u) => [u.achievement_id, u.unlocked_at]),
      );

      const achievements: AchievementView[] = (
        (catalogData ?? []) as Array<{
          id: string;
          code: string;
          name: string;
          description: string | null;
          icon: string;
          category: string;
          required_value: number;
        }>
      ).map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        description: a.description,
        icon: a.icon,
        category: a.category,
        requiredValue: a.required_value,
        unlocked: unlockedMap.has(a.id),
        unlockedAt: unlockedMap.get(a.id) ?? null,
      }));

      gamification = {
        totalXp: xp.total_xp,
        level: lvl.level,
        levelLabel: lvl.label,
        levelIconUrl: lvl.iconUrl,
        progressPct: lvl.progressPct,
        nextMin: lvl.nextMin,
        currentStreak: xp.current_streak,
        longestStreak: xp.longest_streak,
        periodEnd: periodEnd.toISOString(),
        achievements,
      };
    } catch {
      // ignore — gamification opcional
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-npb-gold">
          <UserIcon className="h-3.5 w-3.5" />
          Meu perfil
        </div>
        <h1 className="text-2xl font-bold text-npb-text md:text-3xl">
          Suas informações
        </h1>
        <p className="mt-1 text-sm text-npb-text-muted">
          Atualize seu nome, telefone, foto e troque sua senha.
        </p>
      </header>

      <section>
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
          <ProfileForm
            userId={user.id}
            initialFullName={profile?.full_name ?? ""}
            initialEmail={profile?.email ?? user.email ?? ""}
            initialPhone={profile?.phone ?? ""}
            initialAvatarUrl={profile?.avatar_url ?? null}
            initialEmailNotificationsEnabled={
              profile?.email_notifications_enabled !== false
            }
          />
        </div>
      </section>

      {gamification && <GamificationSection {...gamification} />}

      <section>
        <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-bold text-npb-text">
          <KeyRound className="h-5 w-5 text-npb-gold" />
          Trocar senha
        </h2>
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
          <ChangePasswordForm />
        </div>
      </section>

      <section>
        <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-bold text-npb-text">
          <Layers className="h-5 w-5 text-npb-gold" />
          Suas matrículas
          <span className="rounded bg-npb-bg3 px-2 py-0.5 text-xs text-npb-text-muted">
            {enrollments.length}
          </span>
        </h2>
        {enrollments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-6 text-center text-sm text-npb-text-muted">
            Você ainda não tem matrículas ativas.
          </div>
        ) : (
          <ul className="space-y-2">
            {enrollments.map((e) => {
              const cohort = Array.isArray(e.cohorts) ? e.cohorts[0] : e.cohorts;
              if (!cohort) return null;
              const enrolled = new Date(e.enrolled_at).toLocaleDateString(
                "pt-BR",
              );
              const expires = e.expires_at
                ? new Date(e.expires_at).toLocaleDateString("pt-BR")
                : null;
              const expired =
                e.expires_at && new Date(e.expires_at) < new Date();

              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-xl border border-npb-border bg-npb-bg2 p-4"
                >
                  <Layers className="h-4 w-4 flex-shrink-0 text-npb-text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-npb-text">
                      {cohort.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-npb-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Desde {enrolled}
                      </span>
                      {expires && (
                        <span className={expired ? "text-red-400" : ""}>
                          {expired ? "Expirou" : "Expira"} em {expires}
                        </span>
                      )}
                    </div>
                  </div>
                  {e.is_active && !expired ? (
                    <span className="rounded bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-400">
                      Ativa
                    </span>
                  ) : (
                    <span className="rounded bg-npb-bg3 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-npb-text-muted">
                      Inativa
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
