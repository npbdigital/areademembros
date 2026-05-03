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
import {
  type AffiliateLinkView,
  type AffiliateStats,
  AffiliateSection,
} from "@/components/student/affiliate-section";
import { PushSettingsSection } from "@/components/student/push-settings-section";
import {
  type DecorationOption,
  DecorationSection,
} from "@/components/student/decoration-section";
import { countPaidSales, listActiveDecorations } from "@/lib/decorations";
import { formatDateBrt } from "@/lib/format-date";

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
      "full_name, email, phone, avatar_url, created_at, email_notifications_enabled, role, equipped_decoration_id",
    )
    .eq("id", user.id)
    .single();

  // Admin não tem gamification (XP, conquistas, streak) — não faz sentido
  // pra quem gerencia a plataforma. Pula a seção inteira.
  const isAdminUser = (profile as { role?: string } | null)?.role === "admin";
  const equippedDecorationId =
    (profile as { equipped_decoration_id?: string | null } | null)
      ?.equipped_decoration_id ?? null;

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
    achievements: AchievementView[];
  } | null = null;

  if (settings.gamificationEnabled && !isAdminUser) {
    try {
      const xp = await ensureUserXp(adminSb, user.id);
      const lvl = levelFromXp(xp.total_xp, xp.min_level ?? 1);

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
        achievements,
      };
    } catch {
      // ignore — gamification opcional
    }
  }

  // Afiliado Kiwify
  const { data: linkRow } = await adminSb
    .schema("afiliados")
    .from("affiliate_links")
    .select(
      "kiwify_email, kiwify_name, verified, verified_at, registered_at, cpf_cnpj_last4",
    )
    .eq("member_user_id", user.id)
    .eq("source", "kiwify")
    .maybeSingle();

  const affiliateLink: AffiliateLinkView | null = linkRow
    ? {
        kiwifyEmail: (linkRow as { kiwify_email: string }).kiwify_email,
        kiwifyName: (linkRow as { kiwify_name: string }).kiwify_name,
        verified: (linkRow as { verified: boolean }).verified,
        verifiedAt: (linkRow as { verified_at: string | null }).verified_at,
        registeredAt: (linkRow as { registered_at: string }).registered_at,
        cpfCnpjLast4: (linkRow as { cpf_cnpj_last4: string | null })
          .cpf_cnpj_last4,
      }
    : null;

  // Vendas — usa o email pra pegar tudo (atribuídas e órfãs com mesmo email)
  const kiwifyEmail = affiliateLink?.kiwifyEmail;
  let affiliateStats: AffiliateStats = {
    totalSales: 0,
    paidSales: 0,
    refundedSales: 0,
    totalCommissionCents: 0,
    recentSales: [],
    nameMismatchCount: 0,
  };

  if (kiwifyEmail) {
    const { data: salesData } = await adminSb
      .schema("afiliados")
      .from("sales")
      .select(
        "id, product_name, status, commission_value_cents, approved_at, member_user_id",
      )
      .eq("source", "kiwify")
      .ilike("kiwify_email", kiwifyEmail)
      .order("approved_at", { ascending: false })
      .limit(50);

    const all = (salesData ?? []) as Array<{
      id: string;
      product_name: string | null;
      status: string;
      commission_value_cents: number;
      approved_at: string | null;
      member_user_id: string | null;
    }>;
    // Stats consideram só vendas atribuídas ao user (email + nome batendo)
    const mine = all.filter((s) => s.member_user_id === user.id);
    const orphan = all.filter((s) => s.member_user_id === null);
    const paid = mine.filter((s) => s.status === "paid");
    const refunded = mine.filter(
      (s) => s.status === "refunded" || s.status === "chargedback",
    );

    affiliateStats = {
      totalSales: mine.length,
      paidSales: paid.length,
      refundedSales: refunded.length,
      totalCommissionCents: paid.reduce(
        (sum, s) => sum + s.commission_value_cents,
        0,
      ),
      recentSales: mine.slice(0, 5).map((s) => ({
        id: s.id,
        productName: s.product_name,
        status: s.status,
        commissionCents: s.commission_value_cents,
        approvedAt: s.approved_at,
      })),
      // Vendas com email batendo mas nome NÃO (= órfãs com mesmo email)
      nameMismatchCount: orphan.length,
    };
  }

  // PUSH: dispositivos cadastrados + preferências por categoria
  const [{ data: pushDevicesRaw }, { data: pushPrefsRaw }] = await Promise.all([
    adminSb
      .schema("membros")
      .from("push_subscriptions")
      .select("id, endpoint, user_agent, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    adminSb
      .schema("membros")
      .from("user_notification_prefs")
      .select("category, push_enabled")
      .eq("user_id", user.id),
  ]);
  const pushDevices = (pushDevicesRaw ?? []) as Array<{
    id: string;
    endpoint: string;
    user_agent: string | null;
    created_at: string;
  }>;
  const pushPrefs = (
    (pushPrefsRaw ?? []) as Array<{
      category: string;
      push_enabled: boolean;
    }>
  ).map((p) => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    category: p.category as any,
    pushEnabled: p.push_enabled,
  }));

  // DECORAÇÕES — opções que o aluno pode equipar (desbloqueadas + bloqueadas
  // sem revelar quantas vendas precisa). Admin não tem.
  const decorationOptions: DecorationOption[] = [];
  if (!isAdminUser) {
    const [decorationsRows, paidSalesCount] = await Promise.all([
      listActiveDecorations(adminSb),
      countPaidSales(adminSb, user.id),
    ]);
    for (const d of decorationsRows) {
      decorationOptions.push({
        id: d.id,
        name: d.name,
        imageUrl: d.image_url,
        unlocked: paidSalesCount >= d.required_sales,
      });
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

      {!isAdminUser && (
        <DecorationSection
          avatarUrl={profile?.avatar_url ?? null}
          userName={profile?.full_name ?? null}
          equippedDecorationId={equippedDecorationId}
          options={decorationOptions}
        />
      )}

      <AffiliateSection link={affiliateLink} stats={affiliateStats} />

      <PushSettingsSection
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
        enabledGlobal={settings.pushNotificationsEnabled}
        devices={pushDevices}
        prefs={pushPrefs}
      />

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
              const enrolled = formatDateBrt(e.enrolled_at);
              const expires = e.expires_at ? formatDateBrt(e.expires_at) : null;
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
